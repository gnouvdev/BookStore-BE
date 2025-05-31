const express = require("express");
const router = express.Router();
const {
  getDashboardOverview,
  getMonthlySales,
  getRecentOrders,
  getTopSellingBooks,
  getUsers,
  exportReport,
} = require("./dashboard.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");

// Route cho dashboard
router.get("/overview", verifyAdminToken, getDashboardOverview);
router.get("/monthly-sales", verifyAdminToken, getMonthlySales);
router.get("/recent-orders", verifyAdminToken, getRecentOrders);
router.get("/top-selling-books", verifyAdminToken, getTopSellingBooks);
router.get("/users", verifyAdminToken, getUsers);
router.get("/export", verifyAdminToken, exportReport);

module.exports = router;
