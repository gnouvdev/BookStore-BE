const express = require("express");
const router = express.Router();
const verifyAdminToken = require("../middleware/verifyAdminToken");
const {
  getDashboardOverview,
  getMonthlySales,
  getRecentOrders,
  getTopSellingBooks,
  exportReport,
} = require("./dashboard.controller");

// Tất cả các route đều yêu cầu xác thực admin
router.use(verifyAdminToken);

// Lấy tổng quan dashboard
router.get("/overview", getDashboardOverview);

// Lấy dữ liệu doanh số theo tháng
router.get("/sales", getMonthlySales);

// Lấy danh sách đơn hàng gần đây
router.get("/recent-orders", getRecentOrders);

// Lấy danh sách sách bán chạy
router.get("/top-books", getTopSellingBooks);

// Xuất báo cáo
router.get("/export/:type", exportReport);

module.exports = router;
