require("dotenv").config();

/**
 * Script tạo 500 users với phân bổ Pareto VÀ tăng overlap giữa users
 * để Cosine similarity có giá trị hơn (đạt alpha ~0.2-0.3)
 *
 * Chiến lược:
 * - Tạo các "interest groups" - users trong cùng group có preferences tương tự
 * - Tăng số lượng sách chung giữa users trong cùng group
 * - Điều này giúp Cosine similarity cao hơn, dẫn đến alpha > 0
 */

const mongoose = require("mongoose");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Review = require("../reviews/review.model");
const User = require("../users/user.model");
const Book = require("../books/book.model");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgoMax) {
  const now = new Date();
  const daysAgo = randomInt(0, daysAgoMax);
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

async function createSyntheticUser(userIndex, groupName, interestGroup) {
  const timestamp = Date.now();
  const user = new User({
    firebaseId: `pareto_${groupName}_ig${interestGroup}_${userIndex}_${timestamp}`,
    email: `pareto_${groupName}_ig${interestGroup}_user_${userIndex}_${timestamp}@example.com`,
    password: "$2b$10$dummyHashForTestingPurposes",
    fullName: `Pareto ${groupName} User ${userIndex} (IG${interestGroup})`,
    phone: `0900000${String(userIndex).padStart(3, "0")}`,
    role: "user",
  });

  await user.save();
  return user;
}

async function createInteractionsForUser(
  user,
  books,
  numInteractions,
  popularBooks,
  groupName,
  interestGroup,
  interestGroupBooks // Sách chung cho interest group này
) {
  // Chọn categories ngẫu nhiên cho user
  const allCategories = [];
  for (const b of books) {
    if (b.category) {
      const cats = Array.isArray(b.category) ? b.category : [b.category];
      allCategories.push(...cats.map((c) => c.toString()));
    }
  }
  const uniqueCategories = [...new Set(allCategories)];

  const userCategories = [];
  const numCategories = randomInt(2, Math.min(5, uniqueCategories.length));
  for (let i = 0; i < numCategories && uniqueCategories.length > 0; i++) {
    const cat = randomChoice(uniqueCategories);
    if (!userCategories.includes(cat)) {
      userCategories.push(cat);
    }
  }

  const booksInCategories = books.filter((b) => {
    if (!b.category) return false;
    const cats = Array.isArray(b.category) ? b.category : [b.category];
    return cats.some((c) => userCategories.includes(c.toString()));
  });

  const views = [];
  const reviews = [];

  // Tỷ lệ interactions theo nhóm
  let viewRatio, reviewRatio, wishlistRatio;
  if (groupName === "super") {
    viewRatio = 0.5;
    reviewRatio = 0.3;
    wishlistRatio = 0.2;
  } else if (groupName === "regular") {
    viewRatio = 0.6;
    reviewRatio = 0.25;
    wishlistRatio = 0.15;
  } else {
    viewRatio = 0.7;
    reviewRatio = 0.15;
    wishlistRatio = 0.15;
  }

  // Tạo ViewHistory
  const numViews = Math.floor(numInteractions * viewRatio);
  const viewedBooks = [];

  for (let i = 0; i < numViews; i++) {
    let bookToView;
    const rand = Math.random();

    // CHIẾN LƯỢC: Tăng overlap MẠNH HƠN giữa users trong cùng interest group
    // 60% chọn từ interest group books (sách chung) - TĂNG từ 40%
    // 15% chọn từ popular books
    // 20% chọn từ categories yêu thích
    // 5% chọn random
    if (rand < 0.6 && interestGroupBooks.length > 0) {
      bookToView = randomChoice(interestGroupBooks);
    } else if (rand < 0.75 && popularBooks.length > 0) {
      bookToView = randomChoice(popularBooks);
    } else if (rand < 0.95 && booksInCategories.length > 0) {
      bookToView = randomChoice(booksInCategories);
    } else {
      bookToView = randomChoice(books);
    }

    if (bookToView) {
      const bookId = bookToView._id.toString();
      const viewCount = viewedBooks.filter((b) => b === bookId).length;
      const maxViewsPerBook = groupName === "super" ? 3 : 1;

      if (viewCount < maxViewsPerBook) {
        views.push({
          user: user._id,
          book: bookToView._id,
          timestamp: randomDate(180),
        });
        viewedBooks.push(bookId);
      }
    }
  }

  // Tạo Review
  const maxReviews =
    groupName === "super"
      ? Math.floor(numInteractions * reviewRatio)
      : Math.min(
          Math.floor(numInteractions * reviewRatio),
          Math.floor(views.length * 0.5)
        );
  const numReviews = maxReviews;
  const reviewedBooks = new Set();
  const viewBookIds = views.map((v) => v.book.toString());

  if (groupName === "super" && viewBookIds.length < numReviews) {
    const additionalBooks = books
      .filter((b) => !viewBookIds.includes(b._id.toString()))
      .slice(0, numReviews - viewBookIds.length)
      .map((b) => b._id.toString());
    viewBookIds.push(...additionalBooks);
  }

  for (let i = 0; i < numReviews && viewBookIds.length > 0; i++) {
    const bookId = randomChoice(viewBookIds);
    if (!reviewedBooks.has(bookId)) {
      let rating;
      const ratingRand = Math.random();
      if (ratingRand < 0.6) {
        rating = randomInt(4, 5);
      } else if (ratingRand < 0.9) {
        rating = 3;
      } else {
        rating = randomInt(1, 2);
      }

      reviews.push({
        user: user._id,
        book: bookId,
        rating: rating,
        comment: `Synthetic review for book ${i + 1}`,
        timestamp: randomDate(150),
      });
      reviewedBooks.add(bookId);
    }
  }

  // Tạo Wishlist
  const numWishlist = Math.floor(numInteractions * wishlistRatio);
  const wishlistBookIds = [];

  for (let i = 0; i < numWishlist && books.length > 0; i++) {
    let bookToAdd;
    const rand = Math.random();

    // Tăng overlap: ưu tiên interest group books MẠNH HƠN
    if (rand < 0.65 && interestGroupBooks.length > 0) {
      bookToAdd = randomChoice(interestGroupBooks);
    } else if (rand < 0.8 && popularBooks.length > 0) {
      bookToAdd = randomChoice(popularBooks);
    } else if (rand < 0.95 && booksInCategories.length > 0) {
      bookToAdd = randomChoice(booksInCategories);
    } else {
      bookToAdd = randomChoice(books);
    }

    if (
      bookToAdd &&
      !wishlistBookIds.includes(bookToAdd._id.toString()) &&
      !viewedBooks.includes(bookToAdd._id.toString())
    ) {
      wishlistBookIds.push(bookToAdd._id);
    }
  }

  // Insert vào database
  if (views.length > 0) {
    await ViewHistory.insertMany(views);
  }
  if (reviews.length > 0) {
    await Review.insertMany(reviews);
  }
  if (wishlistBookIds.length > 0) {
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { wishlist: { $each: wishlistBookIds } },
    });
  }

  return {
    views: views.length,
    reviews: reviews.length,
    wishlist: wishlistBookIds.length,
    total: views.length + reviews.length + wishlistBookIds.length,
  };
}

async function deleteAllUsersAndInteractions() {
  console.log("🗑️  Đang xóa TẤT CẢ users và interactions cũ...");

  const viewResult = await ViewHistory.deleteMany({});
  const reviewResult = await Review.deleteMany({});
  const userResult = await User.deleteMany({});

  console.log(`✅ Đã xóa:`);
  console.log(`  - ${userResult.deletedCount} users`);
  console.log(`  - ${viewResult.deletedCount} ViewHistory`);
  console.log(`  - ${reviewResult.deletedCount} Reviews`);
}

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ Thiếu biến môi trường DB_URL");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("TẠO 500 USERS VỚI PARETO + TĂNG OVERLAP (để alpha > 0)");
  console.log("=".repeat(60));

  console.log("\n🔄 Đang kết nối MongoDB...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    await deleteAllUsersAndInteractions();

    const books = await Book.find({}).select("_id category author").lean();

    if (!books.length) {
      console.log("⚠️ Không có books để tạo interactions.");
      return;
    }

    console.log(`📚 Books: ${books.length}`);

    const numPopularBooks = Math.max(5, Math.floor(books.length * 0.075));
    const popularBooks = books.slice(0, numPopularBooks);
    console.log(
      `📖 Popular books: ${popularBooks.length} sách (${(
        (popularBooks.length / books.length) *
        100
      ).toFixed(1)}%)`
    );

    // Tạo Interest Groups: chia books thành các nhóm
    // Users trong cùng interest group sẽ có nhiều sách chung
    const NUM_INTEREST_GROUPS = 4; // Giảm số groups để tăng overlap
    const booksPerGroup = Math.floor(books.length / NUM_INTEREST_GROUPS);
    const interestGroupBooks = [];

    for (let ig = 0; ig < NUM_INTEREST_GROUPS; ig++) {
      const start = ig * booksPerGroup;
      const end =
        ig === NUM_INTEREST_GROUPS - 1
          ? books.length
          : (ig + 1) * booksPerGroup;
      // Mỗi group có nhiều sách hơn để tăng overlap
      const groupBooks = books.slice(start, end);
      // Thêm TẤT CẢ popular books vào mỗi group để tăng overlap mạnh
      // Thêm một số sách từ groups khác để tạo overlap giữa các groups
      const overlapBooks = [
        ...groupBooks,
        ...popularBooks, // Tất cả popular books
        ...books
          .slice(
            ((ig + 1) % NUM_INTEREST_GROUPS) * booksPerGroup,
            (((ig + 1) % NUM_INTEREST_GROUPS) + 1) * booksPerGroup
          )
          .slice(0, 5), // 5 sách từ group tiếp theo
      ];
      interestGroupBooks.push(overlapBooks);
      console.log(
        `  Interest Group ${ig + 1}: ${overlapBooks.length} sách (tăng overlap)`
      );
    }

    const groups = [
      {
        name: "super",
        label: "Siêu người dùng",
        count: 50,
        minInteractions: 1500,
        maxInteractions: 3000,
      },
      {
        name: "regular",
        label: "Phổ thông",
        count: 200,
        minInteractions: 60,
        maxInteractions: 120,
      },
      {
        name: "coldstart",
        label: "Cold-start",
        count: 250,
        minInteractions: 3,
        maxInteractions: 8,
      },
    ];

    const allStats = {
      super: { users: [], interactions: [] },
      regular: { users: [], interactions: [] },
      coldstart: { users: [], interactions: [] },
    };

    // Tạo users cho từng nhóm
    for (const group of groups) {
      console.log(`\n📊 ${group.label} (${group.count} users)...`);

      for (let i = 0; i < group.count; i++) {
        // Phân bổ users vào các interest groups
        const interestGroup = i % NUM_INTEREST_GROUPS;
        const user = await createSyntheticUser(
          i + 1,
          group.name,
          interestGroup
        );
        const numInteractions = randomInt(
          group.minInteractions,
          group.maxInteractions
        );

        const stats = await createInteractionsForUser(
          user,
          books,
          numInteractions,
          popularBooks,
          group.name,
          interestGroup,
          interestGroupBooks[interestGroup]
        );

        allStats[group.name].users.push(user._id);
        allStats[group.name].interactions.push(stats.total);

        if ((i + 1) % 25 === 0) {
          console.log(`  ✓ Đã tạo ${i + 1}/${group.count} users...`);
        }
      }
    }

    // Tính toán thống kê
    console.log("\n" + "=".repeat(60));
    console.log("📊 BẢNG THỐNG KÊ TÓM TẮT");
    console.log("=".repeat(60));

    const calculateStats = (interactions) => {
      if (interactions.length === 0) return { mean: 0, median: 0, total: 0 };
      const sorted = [...interactions].sort((a, b) => a - b);
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      return {
        mean: interactions.reduce((a, b) => a + b, 0) / interactions.length,
        median: median,
        total: interactions.reduce((a, b) => a + b, 0),
      };
    };

    let grandTotal = 0;
    let grandTotalUsers = 0;

    for (const group of groups) {
      const stats = calculateStats(allStats[group.name].interactions);
      grandTotal += stats.total;
      grandTotalUsers += allStats[group.name].users.length;

      console.log(`\n${group.label}:`);
      console.log(`  - Số users: ${allStats[group.name].users.length}`);
      console.log(`  - Tổng interactions: ${stats.total}`);
      console.log(`  - Mean: ${stats.mean.toFixed(2)} interactions/user`);
    }

    console.log("\n" + "-".repeat(60));
    console.log("TỔNG HỢP:");
    console.log(`  - Tổng số users: ${grandTotalUsers}`);
    console.log(`  - Tổng số interactions: ${grandTotal}`);

    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Tổng số users trong database: ${totalUsers}`);
    console.log("\n💡 Bước tiếp theo:");
    console.log("   1. cd backend && node src/utils/exportInteractions.js");
    console.log(
      "   2. cd recommedationsystem && python run_original_experiment.py"
    );
    console.log("   → Kỳ vọng: alpha ~0.2-0.3 (do tăng overlap giữa users)");
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

main().catch(console.error);
