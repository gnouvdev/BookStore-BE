const mongoose = require("mongoose");
const crypto = require("crypto");
const Order = require("../orders/order.model");
const {
  calculateOrderTotals,
  normalizeAddress,
  releaseInventory,
  reserveInventory,
  validateCheckoutPayload,
} = require("../orders/order.service");

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
  const year = gmt7Date.getUTCFullYear();
  const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(gmt7Date.getUTCDate()).padStart(2, "0");
  const hours = String(gmt7Date.getUTCHours()).padStart(2, "0");
  const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(gmt7Date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const normalizePublicUrl = (url) => {
  if (!url) {
    return "";
  }

  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const createVNPayUrl = async (req, res) => {
  try {
    const { orderItems, shippingInfo, paymentMethodId } = req.body;

    validateCheckoutPayload({
      name: shippingInfo?.name,
      email: shippingInfo?.email,
      phone: shippingInfo?.phone,
      address: shippingInfo?.address,
      productIds: orderItems,
    });

    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secretKey = process.env.VNPAY_HASH_SECRET;
    const vnpUrl = process.env.VNPAY_HOST;
    const returnUrl = process.env.VNPAY_RETURN_URL;

    if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
      return res.status(500).json({ error: "VNPay is not configured correctly" });
    }

    const { paymentMethod: vnpayMethod, normalizedItems, subtotal } =
      await calculateOrderTotals(orderItems, paymentMethodId);

    if (!vnpayMethod || vnpayMethod.code !== "VNPAY") {
      return res.status(400).json({ error: "Invalid VNPay payment method" });
    }

    await reserveInventory(normalizedItems);

    const order = new Order({
      user: req.user.id,
      name: shippingInfo.name,
      email: shippingInfo.email,
      address: normalizeAddress(shippingInfo.address),
      phone: shippingInfo.phone,
      productIds: normalizedItems,
      totalPrice: subtotal,
      paymentMethod: vnpayMethod._id,
      status: "pending",
      paymentStatus: "pending",
      inventoryReserved: true,
    });

    await order.save();

    const orderId = order._id.toString();
    const totalAmount = Math.round(subtotal * 100);
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket?.remoteAddress ||
      "127.0.0.1";

    const now = new Date();
    const vnpParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: totalAmount,
      vnp_CreateDate: dateFormat(now),
      vnp_CurrCode: "VND",
      vnp_IpAddr: ipAddr,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
      vnp_OrderType: "250000",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: orderId,
      vnp_ExpireDate: dateFormat(new Date(now.getTime() + 15 * 60 * 1000)),
    };

    const sortedParams = sortObject(vnpParams);
    const signData = Object.keys(sortedParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");

    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    sortedParams.vnp_SecureHash = signed;

    const paymentUrl = `${vnpUrl}?${Object.keys(sortedParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`
      )
      .join("&")}`;

    return res.status(200).json({
      paymentUrl,
      orderId: order._id,
    });
  } catch (error) {
    console.error("VNPay payment creation error:", error);
    return res.status(500).json({
      error: "Failed to create payment URL",
      details: error.message,
    });
  }
};

const handleVNPayIPN = async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams.vnp_SecureHash;

    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    vnpParams = sortObject(vnpParams);

    const secretKey = process.env.VNPAY_HASH_SECRET;
    if (!secretKey) {
      return res.status(200).json({ RspCode: "99", Message: "Config error" });
    }

    const signData = Object.keys(vnpParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(vnpParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash !== signed) {
      return res.status(200).json({ RspCode: "97", Message: "Fail checksum" });
    }

    const orderId = vnpParams.vnp_TxnRef;
    const rspCode = vnpParams.vnp_ResponseCode;
    const transactionStatus = vnpParams.vnp_TransactionStatus;

    const order = await mongoose.model("Order").findOne({ _id: orderId });
    if (!order) {
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    }

    if (rspCode === "00" && transactionStatus === "00") {
      order.paymentStatus = "paid";
      order.status = "processing";
      order.paymentDetails = {
        transactionId: vnpParams.vnp_TransactionNo,
        paymentDate: new Date(),
        paymentAmount: parseInt(vnpParams.vnp_Amount, 10) / 100,
        paymentCurrency: "VND",
      };
      await order.save();
      return res.status(200).json({ RspCode: "00", Message: "Success" });
    }

    if (order.inventoryReserved) {
      await releaseInventory(order.productIds);
      order.inventoryReserved = false;
    }
    order.paymentStatus = "failed";
    order.status = "cancelled";
    await order.save();
    return res.status(200).json({ RspCode: "02", Message: "Transaction failed" });
  } catch (error) {
    console.error("VNPay IPN error:", error);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

const handleVNPayReturn = async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams.vnp_SecureHash;

    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    vnpParams = sortObject(vnpParams);

    const secretKey = process.env.VNPAY_HASH_SECRET;
    const frontendUrl = normalizePublicUrl(process.env.FRONTEND_URL);
    if (!secretKey || !frontendUrl) {
      return res.redirect(`/payment/failed?errorCode=99`);
    }

    const signData = Object.keys(vnpParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(vnpParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      const rspCode = vnpParams.vnp_ResponseCode;
      const orderId = vnpParams.vnp_TxnRef;

      if (rspCode !== "00" && orderId) {
        try {
          const order = await mongoose.model("Order").findOne({ _id: orderId });
          if (order && order.status === "pending") {
            if (order.inventoryReserved) {
              await releaseInventory(order.productIds);
              order.inventoryReserved = false;
            }
            order.status = "cancelled";
            order.paymentStatus = "failed";
            await order.save();
          }
        } catch (orderError) {
          console.error("Error updating order status on VNPay return:", orderError);
        }
      }

      const redirectUrl =
        rspCode === "00"
          ? `${frontendUrl}/payment/success`
          : `${frontendUrl}/payment/failed?errorCode=${rspCode}`;
      return res.redirect(redirectUrl);
    }

    return res.redirect(`${frontendUrl}/payment/failed?errorCode=97`);
  } catch (error) {
    console.error("VNPay return URL error:", error);
    const frontendUrl = normalizePublicUrl(process.env.FRONTEND_URL);
    return res.redirect(`${frontendUrl}/payment/failed?errorCode=99`);
  }
};

module.exports = {
  createVNPayUrl,
  handleVNPayIPN,
  handleVNPayReturn,
};
