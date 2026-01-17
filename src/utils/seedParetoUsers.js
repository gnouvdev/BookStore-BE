require("dotenv").config();

/**
 * Script tạo 500 users mới với phân bổ Pareto (80/20) và Long Tail distribution
 * để phục vụ báo cáo khoa học.
 *
 * Phân bổ:
 * - Siêu người dùng (10% - 50 users): 150-300 interactions
 * - Phổ thông (40% - 200 users): 30-60 interactions
 * - Cold-start (50% - 250 users): 2-5 interactions
 *
 * CÁCH CHẠY:
 *   node backend/src/utils/seedParetoUsers.js
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

async function createSyntheticUser(userIndex, groupName) {
  const timestamp = Date.now();
  const user = new User({
    firebaseId: `pareto_${groupName}_${userIndex}_${timestamp}`,
    email: `pareto_${groupName}_user_${userIndex}_${timestamp}@example.com`,
    password: "$2b$10$dummyHashForTestingPurposes",
    fullName: `Pareto ${groupName} User ${userIndex}`,
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
  groupName
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
    // Siêu người dùng: nhiều reviews và wishlist để tăng interactions
    viewRatio = 0.5; // Giảm views, tăng reviews/wishlist
    reviewRatio = 0.3; // Tăng reviews
    wishlistRatio = 0.2; // Tăng wishlist
  } else if (groupName === "regular") {
    // Phổ thông: cân bằng
    viewRatio = 0.6;
    reviewRatio = 0.25;
    wishlistRatio = 0.15;
  } else {
    // Cold-start: chủ yếu views, ít reviews
    viewRatio = 0.7;
    reviewRatio = 0.15;
    wishlistRatio = 0.15;
  }

  // Tạo ViewHistory
  const numViews = Math.floor(numInteractions * viewRatio);
  const viewedBooks = []; // Dùng array để đếm số lần xem

  for (let i = 0; i < numViews; i++) {
    let bookToView;
    const rand = Math.random();

    // 30% chọn từ popular books (best-seller)
    if (rand < 0.3 && popularBooks.length > 0) {
      bookToView = randomChoice(popularBooks);
    }
    // 50% chọn từ categories yêu thích
    else if (rand < 0.8 && booksInCategories.length > 0) {
      bookToView = randomChoice(booksInCategories);
    }
    // 20% chọn random
    else {
      bookToView = randomChoice(books);
    }

    if (bookToView) {
      // Cho phép duplicate views (user có thể xem lại sách)
      // Nhưng giới hạn số lần xem mỗi sách để tránh quá nhiều
      const bookId = bookToView._id.toString();
      const viewCount = viewedBooks.filter((b) => b === bookId).length;

      // Cho phép xem lại tối đa 3 lần cho siêu người dùng, 1 lần cho các nhóm khác
      const maxViewsPerBook = groupName === "super" ? 3 : 1;

      if (viewCount < maxViewsPerBook) {
        views.push({
          user: user._id,
          book: bookToView._id,
          timestamp: randomDate(180), // Trải dài 6 tháng
        });
        viewedBooks.push(bookId);
      }
    }
  }

  // Tạo Review
  // Siêu người dùng có thể review nhiều sách hơn (không giới hạn bởi views.length)
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

  // Nếu không đủ sách đã xem, thêm sách random để review
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
      // Rating phân bổ: 60% 4-5 sao, 30% 3 sao, 10% 1-2 sao
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
        timestamp: randomDate(150), // Reviews trong 5 tháng gần đây
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

    // 40% chọn từ popular books
    if (rand < 0.4 && popularBooks.length > 0) {
      bookToAdd = randomChoice(popularBooks);
    }
    // 40% chọn từ categories yêu thích
    else if (rand < 0.8 && booksInCategories.length > 0) {
      bookToAdd = randomChoice(booksInCategories);
    }
    // 20% chọn random
    else {
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

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error(
      "❌ Thiếu biến môi trường DB_URL. Vui lòng cấu hình trong file .env"
    );
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Tạo Dataset 500 Users với Phân bổ Pareto (80/20) & Long Tail");
  console.log("=".repeat(60));

  console.log(`\n🔄 Đang kết nối MongoDB...`);
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    const books = await Book.find({}).select("_id category author").lean();

    if (!books.length) {
      console.log("⚠️ Không có books để tạo interactions.");
      return;
    }

    console.log(`📚 Books: ${books.length}`);

    // Xác định popular books (5-10% sách xuất hiện thường xuyên)
    const numPopularBooks = Math.max(5, Math.floor(books.length * 0.075)); // 7.5% là popular
    const popularBooks = books.slice(0, numPopularBooks);
    console.log(
      `📖 Popular books (best-seller): ${popularBooks.length} sách (${(
        (popularBooks.length / books.length) *
        100
      ).toFixed(1)}%)`
    );

    // Định nghĩa các nhóm theo Pareto
    // Lưu ý: target interactions cao hơn để đạt số thực tế mong muốn (do logic filter)
    // Để đạt Pareto 80/20: siêu người dùng cần tạo ra ~80% interactions
    const groups = [
      {
        name: "super",
        label: "Siêu người dùng",
        count: 50, // 10%
        minInteractions: 1500, // Target rất cao để đạt ~300-600 thực tế
        maxInteractions: 3000,
      },
      {
        name: "regular",
        label: "Phổ thông",
        count: 200, // 40%
        minInteractions: 60, // Target cao để đạt ~30-60 thực tế
        maxInteractions: 120,
      },
      {
        name: "coldstart",
        label: "Cold-start",
        count: 250, // 50%
        minInteractions: 3, // Target thấp để đạt ~2-4 thực tế
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
      console.log(
        `\n📊 ${group.label} (${group.count} users, ${group.minInteractions}-${group.maxInteractions} interactions)...`
      );

      for (let i = 0; i < group.count; i++) {
        const user = await createSyntheticUser(i + 1, group.name);
        const numInteractions = randomInt(
          group.minInteractions,
          group.maxInteractions
        );

        const stats = await createInteractionsForUser(
          user,
          books,
          numInteractions,
          popularBooks,
          group.name
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
      console.log(`  - Median: ${stats.median.toFixed(2)} interactions/user`);
      console.log(`  - Min: ${Math.min(...allStats[group.name].interactions)}`);
      console.log(`  - Max: ${Math.max(...allStats[group.name].interactions)}`);
    }

    // Thống kê tổng hợp
    const overallMean = grandTotal / grandTotalUsers;
    const allInteractions = [
      ...allStats.super.interactions,
      ...allStats.regular.interactions,
      ...allStats.coldstart.interactions,
    ];
    const overallMedian = calculateStats(allInteractions).median;

    console.log("\n" + "-".repeat(60));
    console.log("TỔNG HỢP:");
    console.log(`  - Tổng số users: ${grandTotalUsers}`);
    console.log(`  - Tổng số interactions: ${grandTotal}`);
    console.log(
      `  - Mean (tổng thể): ${overallMean.toFixed(2)} interactions/user`
    );
    console.log(
      `  - Median (tổng thể): ${overallMedian.toFixed(2)} interactions/user`
    );

    // Kiểm tra quy luật Pareto
    const top20PercentUsers = Math.floor(grandTotalUsers * 0.2);
    const top20Interactions = allInteractions
      .sort((a, b) => b - a)
      .slice(0, top20PercentUsers)
      .reduce((a, b) => a + b, 0);
    const paretoRatio = (top20Interactions / grandTotal) * 100;

    console.log("\n" + "-".repeat(60));
    console.log("KIỂM CHỨNG QUY LUẬT PARETO (80/20):");
    console.log(
      `  - Top 20% users (${top20PercentUsers} users) tạo ra: ${paretoRatio.toFixed(
        1
      )}% interactions`
    );
    console.log(`  - Lý thuyết: Top 20% users tạo ra ~80% interactions`);
    if (paretoRatio >= 70) {
      console.log(`  ✅ Phù hợp với quy luật Pareto (≥70%)`);
    } else {
      console.log(`  ⚠️  Chưa đạt quy luật Pareto (cần ≥70%)`);
    }

    // Kiểm tra Long Tail
    const bottom50PercentUsers = Math.floor(grandTotalUsers * 0.5);
    const bottom50Interactions = allInteractions
      .sort((a, b) => a - b)
      .slice(0, bottom50PercentUsers)
      .reduce((a, b) => a + b, 0);
    const longTailRatio = (bottom50Interactions / grandTotal) * 100;

    console.log("\n" + "-".repeat(60));
    console.log("KIỂM CHỨNG LONG TAIL:");
    console.log(
      `  - Bottom 50% users (${bottom50PercentUsers} users) tạo ra: ${longTailRatio.toFixed(
        1
      )}% interactions`
    );
    console.log(`  - Lý thuyết: Bottom 50% users tạo ra ~10-20% interactions`);
    if (longTailRatio <= 25) {
      console.log(`  ✅ Phù hợp với Long Tail (≤25%)`);
    } else {
      console.log(`  ⚠️  Chưa đạt Long Tail (cần ≤25%)`);
    }

    // Kiểm tra tổng số users trong database
    const totalUsers = await User.countDocuments();
    console.log("\n" + "-".repeat(60));
    console.log(`📊 Tổng số users trong database: ${totalUsers}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

main().catch(console.error);
