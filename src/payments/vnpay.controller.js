const mongoose = require("mongoose");
const crypto = require("crypto");
const Order = require("../orders/order.model");
const Payment = require("../payments/payment.model");
// Helper function to sort object keys alphabetically
const sortObject = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
};

// Helper function to format date as yyyymmddHHmmss in GMT+7
const dateFormat = (date) => {
  const offset = 7 * 60 * 60 * 1000; // GMT+7 offset in milliseconds
  const gmt7Date = new Date(date.getTime() + offset);
  const year = gmt7Date.getUTCFullYear();
  const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(gmt7Date.getUTCDate()).padStart(2, "0");
  const hours = String(gmt7Date.getUTCHours()).padStart(2, "0");
  const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(gmt7Date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Helper function to calculate total amount from order items
const calculateTotalAmount = async (orderItems) => {
  if (!Array.isArray(orderItems)) {
    throw new Error("Invalid order items format");
  }

  let totalAmount = 0;
  for (const item of orderItems) {
    const book = await mongoose.model("Book").findById(item.productId);
    if (!book) {
      throw new Error(`Book not found with id: ${item.productId}`);
    }
    totalAmount += book.price.newPrice * item.quantity;
  }
  return Math.round(totalAmount * 100); // Convert to smallest currency unit (VND)
};

// Create VNPay payment URL
const createVNPayUrl = async (req, res) => {
  try {
    const { orderItems, user, shippingInfo, paymentMethodId } = req.body;

    // Validate input
    if (!orderItems || !Array.isArray(orderItems)) {
      return res.status(400).json({ error: "Invalid order items" });
    }

    if (!user || !user._id) {
      return res.status(400).json({ error: "User information is required" });
    }

    if (!shippingInfo) {
      return res
        .status(400)
        .json({ error: "Shipping information is required" });
    }

    // Log environment variables
    console.log("Environment variables:", {
      VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE ? "***" : "missing",
      VNPAY_HASH_SECRET: process.env.VNPAY_HASH_SECRET ? "***" : "missing",
      VNPAY_HOST: process.env.VNPAY_HOST,
      VNPAY_RETURN_URL: process.env.VNPAY_RETURN_URL,
    });

    // Configuration
    const tmnCode = process.env.VNPAY_TMN_CODE || "8MZGV9PO";
    const secretKey =
      process.env.VNPAY_HASH_SECRET || "72II7AP2M947ZBB0L9R896UIEIGN8FJ4";
    const vnpUrl =
      process.env.VNPAY_HOST ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl =
      process.env.VNPAY_RETURN_URL ||
      "book-store-fe-steel.vercel.app/orders/thanks";

    // Log configuration
    console.log("VNPay configuration:", {
      tmnCode,
      secretKey: "***",
      vnpUrl,
      returnUrl,
    });

    // Calculate total amount
    const totalAmount = await calculateTotalAmount(orderItems);

    // Find VNPay payment method
    const vnpayMethod = await Payment.findById(paymentMethodId);
    if (!vnpayMethod || vnpayMethod.code !== "VNPAY") {
      return res.status(400).json({ error: "Invalid VNPay payment method" });
    }

    // Create order with pending status
    const order = new Order({
      user: user._id,
      name: shippingInfo.name,
      email: shippingInfo.email,
      address: {
        street: shippingInfo.address?.street || "",
        city: shippingInfo.address?.city,
        country: shippingInfo.address?.country,
        state: shippingInfo.address?.state,
        zipcode: shippingInfo.address?.zipcode,
      },
      phone: shippingInfo.phone,
      productIds: orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      totalPrice: totalAmount / 100,
      paymentMethod: vnpayMethod._id,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // VNPay MUST use string
    const orderId = order._id.toString();

    // Get client IP address
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress ||
      "127.0.0.1";

    // Create VNPay parameters
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

    // Log VNPay parameters
    console.log("VNPay parameters:", vnpParams);

    // Sort parameters
    const sortedParams = sortObject(vnpParams);
    console.log("Sorted parameters:", sortedParams);

    // Create query string manually
    const signData = Object.keys(sortedParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");
    console.log("Sign data:", signData);

    // Generate secure hash
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    console.log("Secure hash:", signed);

    sortedParams["vnp_SecureHash"] = signed;

    // Construct final URL
    const paymentUrl = `${vnpUrl}?${Object.keys(sortedParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`
      )
      .join("&")}`;
    console.log("Payment URL created:", paymentUrl);

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

// Handle VNPay IPN (Instant Payment Notification)
const handleVNPayIPN = async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams["vnp_SecureHash"];

    // Remove checksum parameters
    delete vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHashType"];

    // Sort parameters
    vnpParams = sortObject(vnpParams);

    const secretKey =
      process.env.VNPAY_HASH_SECRET || "72II7AP2M947ZBB0L9R896UIEIGN8FJ4";
    const signData = Object.keys(vnpParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(vnpParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      const orderId = vnpParams["vnp_TxnRef"];
      const rspCode = vnpParams["vnp_ResponseCode"];
      const transactionStatus = vnpParams["vnp_TransactionStatus"];

      const order = await mongoose.model("Order").findOne({ _id: orderId });

      if (!order) {
        return res
          .status(200)
          .json({ RspCode: "01", Message: "Order not found" });
      }

      if (rspCode === "00" && transactionStatus === "00") {
        order.paymentStatus = "paid";
        order.status = "processing";
        order.paymentDetails = {
          transactionId: vnpParams["vnp_TransactionNo"],
          paymentDate: new Date(),
          paymentAmount: parseInt(vnpParams["vnp_Amount"]) / 100,
          paymentCurrency: "VND",
        };
        await order.save();
        return res.status(200).json({ RspCode: "00", Message: "Success" });
      } else {
        // Thanh toán thất bại hoặc user hủy
        order.paymentStatus = "failed";
        // Nếu đơn hàng vẫn ở trạng thái pending, giữ nguyên để user có thể hủy thủ công
        // Không tự động đánh dấu cancelled ở IPN vì có thể user muốn thử lại
        await order.save();
        return res
          .status(200)
          .json({ RspCode: "02", Message: "Transaction failed" });
      }
    } else {
      return res.status(200).json({ RspCode: "97", Message: "Fail checksum" });
    }
  } catch (error) {
    console.error("VNPay IPN error:", error);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

// Handle VNPay Return URL
const handleVNPayReturn = async (req, res) => {
  try {
    let vnpParams = req.query;
    const secureHash = vnpParams["vnp_SecureHash"];

    // Remove checksum parameters
    delete vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHashType"];

    // Sort parameters
    vnpParams = sortObject(vnpParams);

    const secretKey =
      process.env.VNPAY_HASH_SECRET || "72II7AP2M947ZBB0L9R896UIEIGN8FJ4";
    const signData = Object.keys(vnpParams)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(vnpParams[key]).replace(/%20/g, "+")}`
      )
      .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      const rspCode = vnpParams["vnp_ResponseCode"];
      const orderId = vnpParams["vnp_TxnRef"];

      // Nếu thanh toán thất bại hoặc user hủy (rspCode != "00")
      if (rspCode !== "00" && orderId) {
        try {
          const order = await mongoose.model("Order").findOne({ _id: orderId });
          if (order && order.status === "pending") {
            // Đánh dấu đơn hàng là cancelled nếu user hủy thanh toán
            order.status = "cancelled";
            order.paymentStatus = "failed";
            await order.save();
            console.log(`Order ${orderId} cancelled due to VNPay cancellation`);
          }
        } catch (orderError) {
          console.error(
            "Error updating order status on VNPay return:",
            orderError
          );
          // Không throw error, vẫn redirect về frontend
        }
      }

      const redirectUrl =
        rspCode === "00"
          ? `${process.env.FRONTEND_URL}/payment/success`
          : `${process.env.FRONTEND_URL}/payment/failed?errorCode=${rspCode}`;
      return res.redirect(redirectUrl);
    } else {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?errorCode=97`
      );
    }
  } catch (error) {
    console.error("VNPay return URL error:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment/failed?errorCode=99`
    );
  }
};

module.exports = {
  createVNPayUrl,
  handleVNPayIPN,
  handleVNPayReturn,
};
