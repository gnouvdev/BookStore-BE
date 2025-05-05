const express = require("express");
const {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders, // Import hàm lấy danh sách đơn hàng
} = require("./order.controller");

const router = express.Router();

// create order endpoint
router.post("/", createAOrder);

// get orders by user email
router.get("/email/:email", getOrderByEmail);

// get all orders
router.get("/", getAllOrders); // Route để lấy danh sách tất cả đơn hàng

// update order status
router.put("/:id/status", updateOrderStatus); // Route để cập nhật trạng thái đơn hàng

module.exports = router;
