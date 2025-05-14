const Payment = require("./payment.model");
const mongoose = require("mongoose");
require("dotenv").config();

const paymentMethods = [
  {
    name: "COD",
    code: "COD",
    description: "Thanh toán khi nhận hàng (Cash on Delivery)",
    icon: "https://cdn-icons-png.flaticon.com/512/2838/2838895.png",
    isActive: true,
  },
  {
    name: "VNPay",
    code: "VNPAY",
    description: "Thanh toán qua cổng thanh toán VNPay",
    icon: "https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR-1.png",
    isActive: true,
  },
  {
    name: "ZaloPay",
    code: "ZALOPAY",
    description: "Thanh toán qua ví điện tử ZaloPay",
    icon: "https://upload.wikimedia.org/wikipedia/vi/f/fe/ZaloPay_Logo.png",
    isActive: false,
  },
  {
    name: "Momo",
    code: "MOMO",
    description: "Thanh toán qua ví điện tử MoMo",
    icon: "https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png",
    isActive: false,
  },
  {
    name: "Credit Card",
    code: "CREDIT_CARD",
    description: "Thanh toán bằng thẻ tín dụng/ghi nợ",
    icon: "https://cdn-icons-png.flaticon.com/512/196/196578.png",
    isActive: false,
  },
];

const seedPayments = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB");

    // Clear existing payment methods
    await Payment.deleteMany({});
    console.log("Cleared existing payment methods");

    // Insert new payment methods
    const result = await Payment.insertMany(paymentMethods);
    console.log("Added payment methods:", result);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding payment methods:", error);
    process.exit(1);
  }
};

seedPayments();
