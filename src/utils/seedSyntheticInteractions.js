require("dotenv").config();

/**
 * Script sinh thêm dữ liệu tương tác giả lập (synthetic) để
 * làm phong phú dữ liệu cho thực nghiệm offline.
 *
 * CÁCH CHẠY (từ thư mục gốc dự án):
 *   1. Đảm bảo biến môi trường DB_URL trong file .env trỏ đúng tới MongoDB.
 *   2. Chạy:
 *        node backend/src/utils/seedSyntheticInteractions.js
 *
 * LƯU Ý:
 *   - Script này KHÔNG xóa dữ liệu cũ, chỉ chèn thêm ViewHistory, Review, Wishlist.
 *   - KHÔNG tạo thêm Order để tránh ảnh hưởng tới tồn kho (stock).
 *   - Chỉ nên dùng trên môi trường dev / test hoặc sau khi backup dữ liệu.
 */

const mongoose = require("mongoose");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Review = require("../reviews/review.model");
const User = require("../users/user.model");
const Book = require("../books/book.model");

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error(
      "❌ Thiếu biến môi trường DB_URL. Vui lòng cấu hình trong file .env (dùng cùng connection string với backend)."
    );
    process.exit(1);
  }

  console.log("🔄 Đang kết nối MongoDB để seed synthetic interactions...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    const users = await User.find({}).select("_id").lean();
    const books = await Book.find({}).select("_id category author").lean();

    if (!users.length || !books.length) {
      console.log("⚠️ Không có đủ user hoặc book để seed.");
      return;
    }

    console.log(`👤 Users: ${users.length}, 📚 Books: ${books.length}`);

    // Map categoryId -> list of books
    const booksByCategory = new Map();
    for (const b of books) {
      const catId = b.category ? String(b.category) : "none";
      if (!booksByCategory.has(catId)) booksByCategory.set(catId, []);
      booksByCategory.get(catId).push(b);
    }

    // Helper random
    const randInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;
    const sampleArray = (arr, k) => {
      if (k >= arr.length) return [...arr];
      const copy = [...arr];
      const res = [];
      for (let i = 0; i < k; i++) {
        const idx = randInt(0, copy.length - 1);
        res.push(copy[idx]);
        copy.splice(idx, 1);
      }
      return res;
    };

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const viewDocs = [];
    const reviewDocs = [];
    const wishlistUpdates = [];

    // Số lượng synthetic interactions mỗi user (có thể chỉnh)
    const MIN_VIEWS = 10;
    const MAX_VIEWS = 40;
    const MIN_REVIEWS = 2;
    const MAX_REVIEWS = 10;
    const MIN_WISHLIST = 3;
    const MAX_WISHLIST = 10;

    for (const user of users) {
      const userId = user._id;

      // Chọn một vài category ưa thích ngẫu nhiên
      const categoryIds = Array.from(booksByCategory.keys()).filter(
        (id) => booksByCategory.get(id).length > 0
      );
      if (!categoryIds.length) continue;

      const preferredCats = sampleArray(
        categoryIds,
        Math.min(3, categoryIds.length)
      );

      // Tạo view history
      const numViews = randInt(MIN_VIEWS, MAX_VIEWS);
      for (let i = 0; i < numViews; i++) {
        // 80% chọn sách trong category ưa thích, 20% random
        let book;
        if (Math.random() < 0.8) {
          const catId = preferredCats[randInt(0, preferredCats.length - 1)];
          const list = booksByCategory.get(catId);
          if (list && list.length) {
            book = list[randInt(0, list.length - 1)];
          }
        }
        if (!book) {
          book = books[randInt(0, books.length - 1)];
        }

        // Timestamp trong vòng 180 ngày gần đây
        const daysAgo = randInt(0, 180);
        const ts = new Date(now - daysAgo * DAY_MS);

        viewDocs.push({
          user: userId,
          book: book._id,
          timestamp: ts,
        });
      }

      // Tạo review cho một subset của những sách đã xem
      const numReviews = randInt(MIN_REVIEWS, MAX_REVIEWS);
      const viewedBookIds = sampleArray(
        viewDocs
          .filter((v) => String(v.user) === String(userId))
          .map((v) => String(v.book)),
        Math.min(numReviews, numViews)
      );

      for (const bookId of viewedBookIds) {
        // rating thiên về 4–5
        const rating = Math.random() < 0.7 ? randInt(4, 5) : randInt(3, 5);
        const daysAgo = randInt(0, 180);
        const ts = new Date(now - daysAgo * DAY_MS);

        reviewDocs.push({
          user: userId,
          book: bookId,
          rating,
          comment: "Synthetic review for offline evaluation.",
          createdAt: ts,
          updatedAt: ts,
        });
      }

      // Cập nhật wishlist
      const numWishlist = randInt(MIN_WISHLIST, MAX_WISHLIST);
      const wishlistBooks = sampleArray(books, numWishlist).map((b) => b._id);
      wishlistUpdates.push({
        userId,
        bookIds: wishlistBooks,
      });
    }

    console.log(
      `📝 Chuẩn bị insert ~${viewDocs.length} ViewHistory, ~${reviewDocs.length} Review, cập nhật wishlist cho ${wishlistUpdates.length} users.`
    );

    // Insert ViewHistory
    if (viewDocs.length) {
      await ViewHistory.insertMany(viewDocs, { ordered: false });
      console.log(`✅ Đã insert ${viewDocs.length} bản ghi ViewHistory.`);
    }

    // Insert Reviews, bỏ qua duplicate (unique user+book)
    if (reviewDocs.length) {
      try {
        await Review.insertMany(reviewDocs, { ordered: false });
        console.log(`✅ Đã insert ${reviewDocs.length} bản ghi Review.`);
      } catch (err) {
        console.warn(
          "⚠️ Một số review bị trùng (user,book) do unique index, đã bị bỏ qua."
        );
      }
    }

    // Cập nhật wishlist (push thêm, tránh trùng lặp)
    for (const w of wishlistUpdates) {
      await User.updateOne(
        { _id: w.userId },
        {
          $addToSet: { wishlist: { $each: w.bookIds } },
        }
      );
    }
    console.log(`✅ Đã cập nhật wishlist cho ${wishlistUpdates.length} users.`);

    console.log("🎉 Seed synthetic interactions hoàn tất.");
  } catch (err) {
    console.error("❌ Lỗi khi seed synthetic interactions:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối MongoDB");
  }
}

main().catch((err) => {
  console.error("❌ Lỗi không mong muốn:", err);
  process.exit(1);
});
