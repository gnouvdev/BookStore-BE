const Review = require("./review.model");
const Order = require("../orders/order.model");
const { validateObjectId } = require("../utils/validateObjectId");

// Tạo đánh giá mới
exports.createReview = async (req, res) => {
  try {
    const { bookId, rating, comment } = req.body;
    const userEmail = req.user.email;

    console.log("Creating review with data:", {
      bookId,
      userEmail,
      rating,
      comment,
    });

    // Validate input
    if (!validateObjectId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    // Kiểm tra xem người dùng đã mua sách và đơn hàng đã hoàn thành chưa
    const completedOrder = await Order.findOne({
      email: userEmail,
      status: "completed",
      productIds: {
        $elemMatch: {
          productId: bookId,
        },
      },
    });

    console.log("Found completed order:", completedOrder);

    if (!completedOrder) {
      // Kiểm tra thêm để xem có đơn hàng nào không
      const anyOrder = await Order.findOne({
        email: userEmail,
        productIds: {
          $elemMatch: {
            productId: bookId,
          },
        },
      });

      console.log("Any order found:", anyOrder);

      // Kiểm tra cấu trúc của productIds trong đơn hàng
      if (anyOrder) {
        console.log(
          "Order productIds structure:",
          JSON.stringify(anyOrder.productIds, null, 2)
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "You can only review books that you have purchased and the order is completed",
        debug: {
          hasAnyOrder: !!anyOrder,
          orderStatus: anyOrder?.status,
        },
      });
    }

    // Kiểm tra xem đã đánh giá chưa
    const existingReview = await Review.findOne({
      user: req.user.id,
      book: bookId,
    });

    console.log("Existing review:", existingReview);

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this book",
        reviewId: existingReview._id,
      });
    }

    // Tạo đánh giá mới
    const review = await Review.create({
      user: req.user.id,
      book: bookId,
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
