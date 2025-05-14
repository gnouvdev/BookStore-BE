const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["COD", "VNPay", "ZaloPay", "Momo", "Credit Card"],
    },
    description: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    icon: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
