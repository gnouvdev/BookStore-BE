const express = require("express");
const router = express.Router();
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} = require("./payment.controller");

const verifyAdminToken = require("../middleware/verifyAdminToken");

// Public routes
router.get("/", getPaymentMethods);



// Admin routes
router.post("/", verifyAdminToken, addPaymentMethod);
router.put("/:id", verifyAdminToken, updatePaymentMethod);
router.delete("/:id", verifyAdminToken, deletePaymentMethod);

module.exports = router;
