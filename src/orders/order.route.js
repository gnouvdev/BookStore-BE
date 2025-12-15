const express = require("express");
const {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders, // Import hàm lấy danh sách đơn hàng
  getOrdersByUserId,
  deleteOrder,
  getOrderById,
  cancelOrder,
} = require("./order.controller");
const verifyToken = require("../middleware/verifyToken");
const verifyAdminToken = require("../middleware/verifyAdminToken");

const router = express.Router();

// Protected routes - require user authentication
router.post("/", verifyToken, createAOrder);
router.get("/email/:email", verifyToken, getOrderByEmail);
router.get("/user/:userId", verifyToken, getOrdersByUserId);
router.get("/:id", verifyToken, getOrderById);
router.put("/:id/cancel", verifyToken, cancelOrder); // User có thể hủy đơn hàng của mình

// Admin only routes
router.get("/", verifyAdminToken, getAllOrders);
router.put("/:id/status", verifyAdminToken, updateOrderStatus);
router.delete("/:id", verifyAdminToken, deleteOrder);

module.exports = router;
