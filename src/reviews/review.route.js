const express = require("express");
const router = express.Router();
const  verifyToken  = require("../middleware/verifyToken");
const { createReview, getBookReviews } = require("./review.controller");

// Tạo đánh giá mới (yêu cầu đăng nhập)
router.post("/", verifyToken, createReview);

// Lấy danh sách đánh giá của một sách (không yêu cầu đăng nhập)
router.get("/book/:bookId", getBookReviews);

module.exports = router;
