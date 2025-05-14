const Review = require("./review.model");
const Order = require("../orders/order.model");
const { validateObjectId } = require("../utils/validateObjectId");

// Tạo đánh giá mới
exports.createReview = async (req, res) => {
  try {
    const { bookId, orderId, rating, comment } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!validateObjectId(bookId) || !validateObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book or order ID",
      });
    }

    // Kiểm tra đơn hàng
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only review books from completed orders",
        orderStatus: order.status,
      });
    }

    // Kiểm tra xem sản phẩm có trong đơn hàng không
    const productInOrder = order.productIds.find(
      (item) => item.productId.toString() === bookId
    );

    if (!productInOrder) {
      return res.status(400).json({
        success: false,
        message: "Book not found in this order",
        orderId,
        bookId,
      });
    }

    // Kiểm tra xem đã đánh giá chưa
    const existingReview = await Review.findOne({
      user: userId,
      book: bookId,
      order: orderId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this book for this order",
        reviewId: existingReview._id,
      });
    }

    // Tạo đánh giá mới
    const review = await Review.create({
      user: userId,
      book: bookId,
      order: orderId,
      rating,
      comment,
    });

    // Populate thông tin user
    await review.populate("user", "displayName email photoURL");

    res.status(201).json({
      success: true,
      data: review,
      message: "Review created successfully",
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

// Lấy danh sách đánh giá của một sách
exports.getBookReviews = async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!validateObjectId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const reviews = await Review.find({ book: bookId })
      .populate("user", "displayName email photoURL")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews,
      total: reviews.length,
    });
  } catch (error) {
    console.error("Get book reviews error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};
