const express = require("express");
const router = express.Router();
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} = require("./payment.controller");
const {
  createVNPayUrl,
  handleVNPayIPN,
  handleVNPayReturn,
} = require("./vnpay.controller");
const verifyToken = require("../middleware/verifyToken");
const verifyAdminToken = require("../middleware/verifyAdminToken");

// Public routes
router.get("/", getPaymentMethods);
router.post("/vnpay/create", verifyToken, createVNPayUrl);
router.get("/vnpay/ipn", handleVNPayIPN);
router.get("/vnpay/return", handleVNPayReturn);

// Admin routes
router.post("/", verifyAdminToken, addPaymentMethod);
router.put("/:id", verifyAdminToken, updatePaymentMethod);
router.delete("/:id", verifyAdminToken, deletePaymentMethod);

module.exports = router;
