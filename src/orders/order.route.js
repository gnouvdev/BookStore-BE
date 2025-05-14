const express = require("express");
const {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders, // Import hàm lấy danh sách đơn hàng
  getOrdersByUserId,
} = require("./order.controller");
const verifyToken = require("../middleware/verifyToken");
const verifyAdminToken = require("../middleware/verifyAdminToken");

const router = express.Router();

// Protected routes - require user authentication
router.post("/", verifyToken, createAOrder);
router.get("/email/:email", verifyToken, getOrderByEmail);
router.get("/user/:userId", verifyToken, getOrdersByUserId);

// Admin only routes
router.get("/", verifyAdminToken, getAllOrders);
router.put("/:id/status", verifyAdminToken, updateOrderStatus);

module.exports = router;
