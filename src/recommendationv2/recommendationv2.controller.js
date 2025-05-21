const mongoose = require("mongoose");
const Order = require("../orders/order.model");
const Review = require("../reviews/review.model");
const Cart = require("../cart/cart.model");
const Book = require("../books/book.model");

exports.getCollaborativeRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Fetching collaborative recommendations for user:", userId);

    // Lấy sách người dùng đã mua, đánh giá, hoặc thêm vào giỏ hàng
    const userOrders = await Order.find({ user: userId }).populate("productIds.productId");
    const userReviews = await Review.find({ user: userId }).populate("book");
    const userCart = await Cart.findOne({ userId }).populate("items.bookId");
    const userBookIds = new Set([
      ...userOrders.flatMap(o => o.productIds.map(p => p.productId._id.toString())),
      ...userReviews.map(r => r.book._id.toString()),
      ...(userCart ? userCart.items.map(i => i.bookId._id.toString()) : [])
    ]);
    console.log("User books:", [...userBookIds]);

    // Tìm người dùng khác
    const allOrders = await Order.find({ user: { $ne: userId } }).populate("productIds.productId");
    const allReviews = await Review.find({ user: { $ne: userId } }).populate("book");
    const allCarts = await Cart.find({ userId: { $ne: userId } }).populate("items.bookId");
    const similarUsers = [];

    // Tính độ tương đồng
    const otherUsers = {};
    allOrders.forEach(order => {
      const otherUserId = order.user.toString();
      if (!otherUsers[otherUserId]) otherUsers[otherUserId] = new Set();
      order.productIds.forEach(p => otherUsers[otherUserId].add(p.productId._id.toString()));
    });
    allReviews.forEach(review => {
      const otherUserId = review.user.toString();
      if (!otherUsers[otherUserId]) otherUsers[otherUserId] = new Set();
      otherUsers[otherUserId].add(review.book._id.toString());
    });
    allCarts.forEach(cart => {
      const otherUserId = cart.userId.toString();
      if (!otherUsers[otherUserId]) otherUsers[otherUserId] = new Set();
      cart.items.forEach(i => otherUsers[otherUserId].add(i.bookId._id.toString()));
    });

    for (const [otherUserId, otherBookIds] of Object.entries(otherUsers)) {
      const commonBooks = [...userBookIds].filter(id => otherBookIds.has(id));
      if (commonBooks.length > 0) {
        similarUsers.push({
          userId: otherUserId,
          similarity: commonBooks.length
        });
      }
    }

    // Sắp xếp và lấy top 5 người dùng tương tự
    similarUsers.sort((a, b) => b.similarity - a.similarity);
    const topSimilarUsers = similarUsers.slice(0, 5).map(u => u.userId);
    console.log("Top similar users:", topSimilarUsers);

    // Lấy sách từ người dùng tương giống
    const recommendedBooks = await Order.find({
      user: { $in: topSimilarUsers },
      "productIds.productId": { $nin: [...userBookIds] }
    }).populate({
      path: "productIds.productId",
      populate: [
        { path: "author", select: "name" },
        { path: "category", select: "name" }
      ]
    });

    const books = recommendedBooks
      .flatMap(o => o.productIds.map(p => p.productId))
      .filter((book, index, self) => self.findIndex(b => b._id.equals(book._id)) === index)
      .map(book => ({
        _id: book._id,
        title: book.title,
        author: book.author.name,
        category: book.category.name,
        coverImage: book.coverImage,
        price: book.price.newPrice,
        description: book.description
      }))
      .slice(0, 10);

    console.log("Recommended books:", books.map(b => b._id.toString()));
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    console.error("Collaborative recommendation error:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};