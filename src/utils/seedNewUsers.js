require("dotenv").config();

/**
 * Script tạo thêm users mới với interactions synthetic để tăng dataset.
 *
 * CÁCH CHẠY:
 *   node backend/src/utils/seedNewUsers.js [number_of_users]
 *
 * Ví dụ: node backend/src/utils/seedNewUsers.js 100
 * → Tạo 100 users mới với interactions (40-60 interactions/user, trung bình ~50)
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

function randomDate(startDate, daysAgoMax) {
  const now = new Date();
  const daysAgo = randomInt(0, daysAgoMax);
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

async function createSyntheticUser(userIndex) {
  // Tạo user mới với email và firebaseId unique
  const timestamp = Date.now();
  const user = new User({
    firebaseId: `synthetic_${userIndex}_${timestamp}`, // Required unique field
    email: `synthetic_user_${userIndex}_${timestamp}@example.com`,
    password: "$2b$10$dummyHashForTestingPurposes", // Dummy hash
    fullName: `Synthetic User ${userIndex}`,
    phone: `0900000${String(userIndex).padStart(3, "0")}`,
    role: "user",
  });

  await user.save();
  return user;
}

async function createInteractionsForUser(user, books, numInteractions) {
  // Chọn categories ngẫu nhiên cho user (tạo preferences)
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

  // Filter books theo categories yêu thích (70%) hoặc random (30%)
  const booksInCategories = books.filter((b) => {
    if (!b.category) return false;
    const cats = Array.isArray(b.category) ? b.category : [b.category];
    return cats.some((c) => userCategories.includes(c.toString()));
  });

  const views = [];
  const reviews = [];
  const wishlistBookIds = [];

  // Tạo ViewHistory (60% của tổng interactions)
  const numViews = Math.floor(numInteractions * 0.6);
  const viewedBooks = new Set();

  for (let i = 0; i < numViews; i++) {
    let bookToView;
    if (Math.random() < 0.7 && booksInCategories.length > 0) {
      // 70% chọn từ categories yêu thích
      bookToView = randomChoice(booksInCategories);
    } else {
      // 30% chọn random
      bookToView = randomChoice(books);
    }

    if (bookToView && !viewedBooks.has(bookToView._id.toString())) {
      views.push({
        user: user._id,
        book: bookToView._id,
        timestamp: randomDate(new Date(), 180),
      });
      viewedBooks.add(bookToView._id.toString());
    }
  }

  // Tạo Review (khoảng 20-25% của viewed books, tối đa 10 reviews)
  const numReviews = Math.min(randomInt(3, 10), Math.floor(views.length * 0.4));
  const reviewedBooks = new Set();
  const viewBookIds = views.map((v) => v.book.toString());

  for (let i = 0; i < numReviews && viewBookIds.length > 0; i++) {
    const bookId = randomChoice(viewBookIds);
    if (!reviewedBooks.has(bookId)) {
      const rating = randomInt(3, 5); // Bias về 3-5 sao (sách đã xem thường đánh giá cao)
      reviews.push({
        user: user._id,
        book: bookId,
        rating: rating,
        comment: `Synthetic review for book ${i + 1}`,
        timestamp: randomDate(new Date(), 150),
      });
      reviewedBooks.add(bookId);
    }
  }

  // Tạo Wishlist (khoảng 3-8 items) - lưu vào User.wishlist array
  const numWishlist = randomInt(3, 8);

  for (let i = 0; i < numWishlist && books.length > 0; i++) {
    let bookToAdd;
    if (Math.random() < 0.6 && booksInCategories.length > 0) {
      bookToAdd = randomChoice(booksInCategories);
    } else {
      bookToAdd = randomChoice(books);
    }

    if (bookToAdd && !wishlistBookIds.includes(bookToAdd._id.toString())) {
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
    // Thêm wishlist vào User model
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { wishlist: { $each: wishlistBookIds } },
    });
  }

  return {
    views: views.length,
    reviews: reviews.length,
    wishlist: wishlistBookIds.length,
  };
}

async function main() {
  // Hỗ trợ 2 cách gọi:
  // 1. node seedNewUsers.js [num_users] [min_interactions] [max_interactions]
  // 2. node seedNewUsers.js [num_users] (dùng default 100-120)
  const numUsersToCreate = parseInt(process.argv[2]) || 50;
  const minInteractions = parseInt(process.argv[3]) || 100;
  const maxInteractions = parseInt(process.argv[4]) || 120;

  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error(
      "❌ Thiếu biến môi trường DB_URL. Vui lòng cấu hình trong file .env"
    );
    process.exit(1);
  }

  console.log(
    `🔄 Đang kết nối MongoDB để tạo ${numUsersToCreate} users mới...`
  );
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    const books = await Book.find({}).select("_id category author").lean();

    if (!books.length) {
      console.log("⚠️ Không có books để tạo interactions.");
      return;
    }

    console.log(`📚 Books: ${books.length}`);

    const totalInteractions = {
      views: 0,
      reviews: 0,
      wishlist: 0,
    };

    const avgTarget = Math.floor(
      ((minInteractions + maxInteractions) / 2) * 0.5
    ); // Ước tính trung bình thực tế
    console.log(
      `\n🔄 Đang tạo ${numUsersToCreate} users mới (${minInteractions}-${maxInteractions} interactions target, ~${avgTarget} thực tế)...\n`
    );

    for (let i = 0; i < numUsersToCreate; i++) {
      // Tạo user mới
      const user = await createSyntheticUser(i + 1);

      // Tạo interactions (số lượng ngẫu nhiên từ minInteractions-maxInteractions)
      // Lưu ý: số interactions thực tế sẽ thấp hơn do logic filter (duplicate, etc)
      const numInteractions = randomInt(minInteractions, maxInteractions);
      const stats = await createInteractionsForUser(
        user,
        books,
        numInteractions
      );

      totalInteractions.views += stats.views;
      totalInteractions.reviews += stats.reviews;
      totalInteractions.wishlist += stats.wishlist;

      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ Đã tạo ${i + 1}/${numUsersToCreate} users...`);
      }
    }

    console.log(`\n✅ Hoàn thành! Đã tạo ${numUsersToCreate} users mới với:`);
    console.log(`  - ViewHistory: ${totalInteractions.views}`);
    console.log(`  - Review: ${totalInteractions.reviews}`);
    console.log(`  - Wishlist: ${totalInteractions.wishlist}`);
    console.log(
      `  - Tổng interactions: ${
        totalInteractions.views +
        totalInteractions.reviews +
        totalInteractions.wishlist
      }`
    );
    console.log(
      `  - Trung bình: ${(
        (totalInteractions.views +
          totalInteractions.reviews +
          totalInteractions.wishlist) /
        numUsersToCreate
      ).toFixed(1)} interactions/user`
    );

    // Kiểm tra tổng số users hiện tại
    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Tổng số users trong database: ${totalUsers}`);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

main().catch(console.error);
