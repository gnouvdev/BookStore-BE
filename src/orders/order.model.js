const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: {
      street: String,
      city: { type: String, required: true },
      country: String,
      state: String,
      zipcode: String,
    },
    phone: { type: String, required: true },
    productIds: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
      },
    ],
    totalPrice: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "completed", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentDetails: {
      transactionId: { type: String, required: function () { return this.paymentStatus === "paid"; } },
      paymentDate: { type: Date, required: function () { return this.paymentStatus === "paid"; } },
      paymentAmount: { type: Number, required: function () { return this.paymentStatus === "paid"; } },
      paymentCurrency: { type: String, default: "VND" },
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;