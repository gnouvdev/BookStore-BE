const express = require("express");
const {
  validateVoucher,
  applyVoucher,
  createVoucher,
  getAllVouchers,
  updateVoucher,
  deleteVoucher,
} = require("./voucher.controller");
const verifyAdminToken = require("../src/middleware/verifyAdminToken");

const router = express.Router();

// Admin routes
router.post("/create", verifyAdminToken, createVoucher);

// User routes
router.post("/validate", validateVoucher);
router.post("/apply", applyVoucher);
router.get("/", verifyAdminToken, getAllVouchers);
router.patch("/:voucherId", verifyAdminToken, updateVoucher);
router.delete("/:voucherId", verifyAdminToken, deleteVoucher);
module.exports = router;
