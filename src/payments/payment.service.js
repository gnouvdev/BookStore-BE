// services/vnpay.service.js
const crypto = require("crypto");
const Payment = require("../payments/payment.model");
const Order = require("../orders/order.model");
const mongoose = require("mongoose");

// helpers (copy từ controller)
const sortObject = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
};

const dateFormat = (date) => {
  const offset = 7 * 60 * 60 * 1000;
  const gmt7Date = new Date(date.getTime() + offset);
  return (
    gmt7Date.getUTCFullYear().toString() +
    String(gmt7Date.getUTCMonth() + 1).padStart(2, "0") +
    String(gmt7Date.getUTCDate()).padStart(2, "0") +
    String(gmt7Date.getUTCHours()).padStart(2, "0") +
    String(gmt7Date.getUTCMinutes()).padStart(2, "0") +
    String(gmt7Date.getUTCSeconds()).padStart(2, "0")
  );
};

async function createVNPayPaymentUrl({
  orderId,
  userId,
  shippingInfo,
  paymentMethodId,
  ipAddr = "127.0.0.1",
}) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const payment = await Payment.findById(paymentMethodId);
  if (!payment || payment.code !== "VNPAY") {
    throw new Error("Invalid VNPay method");
  }

  const tmnCode = process.env.VNPAY_TMN_CODE;
  const secretKey = process.env.VNPAY_HASH_SECRET;
  const vnpUrl = process.env.VNPAY_HOST;
  const returnUrl = process.env.VNPAY_RETURN_URL;

  const amount = Math.round(order.totalPrice * 100);
  const now = new Date();

  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: amount,
    vnp_CreateDate: dateFormat(now),
    vnp_CurrCode: "VND",
    vnp_IpAddr: ipAddr,
    vnp_Locale: "vn",
    vnp_OrderInfo: `Thanh toan don hang ${order._id}`,
    vnp_OrderType: "250000",
    vnp_ReturnUrl: returnUrl,
    vnp_TxnRef: order._id.toString(),
  };

  const sorted = sortObject(vnpParams);

  const signData = Object.keys(sorted)
    .map(
      (key) =>
        `${key}=${encodeURIComponent(sorted[key]).replace(/%20/g, "+")}`
    )
    .join("&");

  const secureHash = crypto
    .createHmac("sha512", secretKey)
    .update(signData)
    .digest("hex");

  sorted.vnp_SecureHash = secureHash;

  const paymentUrl =
    vnpUrl +
    "?" +
    Object.keys(sorted)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(sorted[key]).replace(/%20/g, "+")}`
      )
      .join("&");

  return paymentUrl;
}

module.exports = {
  createVNPayPaymentUrl,
};
