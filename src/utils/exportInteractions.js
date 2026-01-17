require("dotenv").config();

/**
 * Script export dữ liệu tương tác user–book từ MongoDB
 * ra file CSV để dùng cho thực nghiệm offline (Python).
 *
 * CÁCH CHẠY (từ thư mục gốc dự án):
 *   1. Đảm bảo biến môi trường DB_URL trong file .env trỏ đúng tới MongoDB.
 *   2. Chạy:
 *        node backend/src/utils/exportInteractions.js
 *
 * Kết quả:
 *   File recommedationsystem/interactions.csv sẽ được tạo/ghi đè.
 *
 * Mỗi dòng:
 *   userId,bookId,type,timestamp,rating,quantity
 *
 * type:
 *   - "order"   : từ collection Order (mua sách)
 *   - "review"  : từ collection Review (đánh giá)
 *   - "view"    : từ collection ViewHistory (xem sách)
 *   - "cart"    : từ collection Cart (thêm giỏ hàng)
 *   - "wishlist": từ field wishlist trong User
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Order = require("../orders/order.model");
const Review = require("../reviews/review.model");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Cart = require("../cart/cart.model");
const User = require("../users/user.model");
const SearchHistory = require("../searchHistory/searchHistory.model");
const Book = require("../books/book.model");

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error(
      "❌ Thiếu biến môi trường DB_URL. Vui lòng cấu hình trong file .env (dùng cùng connection string với backend)."
    );
    process.exit(1);
  }

  console.log("🔄 Đang kết nối MongoDB để export interactions...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  const rows = [];

  // Helper function để random choice
  function randomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Helper để push một dòng CSV (escape cơ bản)
  const pushRow = ({
    userId,
    bookId,
    type,
    timestamp,
    rating = "",
    quantity = "",
  }) => {
    if (!userId || !bookId || !type || !timestamp) return;
    rows.push({
      userId: userId.toString(),
      bookId: bookId.toString(),
      type,
      timestamp: new Date(timestamp).toISOString(),
      rating: rating === "" ? "" : String(rating),
      quantity: quantity === "" ? "" : String(quantity),
    });
  };

  try {
    // 1. Orders -> type = "order"
    console.log("📦 Đang đọc Orders...");
    const orders = await Order.find({})
      .select("user productIds createdAt")
      .lean();

    for (const order of orders) {
      if (!order.user || !order.productIds) continue;
      for (const item of order.productIds) {
        if (!item.productId) continue;
        pushRow({
          userId: order.user,
          bookId: item.productId,
          type: "order",
          timestamp: order.createdAt,
          rating: "",
          quantity: item.quantity || 1,
        });
      }
    }
    console.log(
      `  → Đã export ${orders.length} orders (nhiều dòng interactions).`
    );

    // 2. Reviews -> type = "review"
    console.log("⭐ Đang đọc Reviews...");
    const reviews = await Review.find({})
      .select("user book rating createdAt")
      .lean();

    for (const review of reviews) {
      if (!review.user || !review.book) continue;
      pushRow({
        userId: review.user,
        bookId: review.book,
        type: "review",
        timestamp: review.createdAt,
        rating: review.rating || "",
        quantity: "",
      });
    }
    console.log(`  → Đã export ${reviews.length} reviews.`);

    // 3. ViewHistory -> type = "view"
    console.log("👀 Đang đọc ViewHistory...");
    const views = await ViewHistory.find({})
      .select("user book timestamp")
      .lean();

    for (const view of views) {
      if (!view.user || !view.book || !view.timestamp) continue;
      pushRow({
        userId: view.user,
        bookId: view.book,
        type: "view",
        timestamp: view.timestamp,
        rating: "",
        quantity: "",
      });
    }
    console.log(`  → Đã export ${views.length} lượt xem.`);

    // 4. Cart -> type = "cart"
    console.log("🛒 Đang đọc Carts...");
    const carts = await Cart.find({}).select("user items updatedAt").lean();

    for (const cart of carts) {
      if (!cart.user || !Array.isArray(cart.items)) continue;
      for (const item of cart.items) {
        if (!item.book) continue;
        pushRow({
          userId: cart.user,
          bookId: item.book,
          type: "cart",
          timestamp: cart.updatedAt || new Date(),
          rating: "",
          quantity: item.quantity || 1,
        });
      }
    }
    console.log(
      `  → Đã export ${carts.length} carts (nhiều dòng interactions).`
    );

    // 5. Wishlist trong User -> type = "wishlist"
    console.log("💖 Đang đọc Wishlist của Users...");
    const users = await User.find({})
      .select("_id wishlist createdAt updatedAt")
      .lean();

    for (const user of users) {
      if (!Array.isArray(user.wishlist)) continue;
      for (const bookId of user.wishlist) {
        if (!bookId) continue;
        // Dùng updatedAt nếu có, fallback createdAt, nếu không có dùng now
        const ts = user.updatedAt || user.createdAt || new Date();
        pushRow({
          userId: user._id,
          bookId,
          type: "wishlist",
          timestamp: ts,
          rating: "",
          quantity: "",
        });
      }
    }
    console.log(
      `  → Đã export wishlist cho ${users.length} users (nhiều dòng interactions).`
    );

    // 6. SearchHistory -> type = "search"
    // Lưu ý: SearchHistory chỉ có query, không có bookId
    // Giả định: user search và click vào một book (cần map query -> bookId)
    console.log("🔍 Đang đọc SearchHistory...");
    const searches = await SearchHistory.find({})
      .select("user query timestamp")
      .lean();

    // Map search queries to books (giả định user click vào book sau khi search)
    // Strategy: Random book từ popular books hoặc interest group
    const allBooks = await Book.find({}).select("_id").lean();

    for (const search of searches) {
      if (!search.user || !search.query) continue;
      // Giả định user click vào một book random sau khi search
      // (Trong thực tế, cần có SearchClickHistory để lưu bookId)
      const clickedBook = randomChoice(allBooks);
      if (clickedBook) {
        pushRow({
          userId: search.user,
          bookId: clickedBook._id,
          type: "search",
          timestamp: search.timestamp || new Date(),
          rating: "",
          quantity: "",
        });
      }
    }
    console.log(`  → Đã export ${searches.length} searches.`);

    // Ghi file CSV
    console.log("💾 Đang ghi file CSV...");
    const header = "userId,bookId,type,timestamp,rating,quantity\n";
    const csvLines = rows.map(
      (r) =>
        `${r.userId},${r.bookId},${r.type},${r.timestamp},${r.rating},${r.quantity}`
    );
    const csvContent = header + csvLines.join("\n");

    const outPath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "recommedationsystem",
      "interactions.csv"
    );

    fs.writeFileSync(outPath, csvContent, "utf8");
    console.log(`✅ Đã ghi ${rows.length} dòng interactions vào: ${outPath}`);
  } catch (err) {
    console.error("❌ Lỗi khi export interactions:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối MongoDB");
  }
}

main().catch((err) => {
  console.error("❌ Lỗi không mong muốn:", err);
  process.exit(1);
});
