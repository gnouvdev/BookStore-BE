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
    config: {
      type: Map,
      of: String,
      default: {},
    },
    minAmount: {
      type: Number,
      default: 0,
    },
    maxAmount: {
      type: Number,
      default: 1000000000,
    },
    processingFee: {
      type: Number,
      default: 0,
    },
    processingFeeType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "fixed",
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ code: 1 });
paymentSchema.index({ isActive: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
