const express = require("express");
const router = express.Router();
const {
  login,
  register,
  forgotPassword,
  resetPassword,
} = require("./auth.controller");
const User = require("../users/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

// Auth routes
router.post("/login", login);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

const resetPasswordHandler = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token và mật khẩu mới là bắt buộc" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res
        .status(400)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // Tìm user theo email trong token
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Hash mật khẩu mới cho MongoDB
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Đổi mật khẩu trên Firebase
    if (user.firebaseId) {
      await admin.auth().updateUser(user.firebaseId, { password: newPassword });
    }

    res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Lỗi khi đặt lại mật khẩu" });
  }
};

module.exports = router;
