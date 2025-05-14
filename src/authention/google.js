// google.js (Backend Route)

const admin = require("../../firebaseAdmin"); // Import Firebase Admin
const jwt = require("jsonwebtoken");
const User = require("../user.model"); // MongoDB Model
const router = require("express").Router();

const JWT_SECRET = process.env.JWT_SECRET_KEY;

router.post("/google", async (req, res) => {
  const { idToken } = req.body; // ID token từ frontend

  try {
    // 1. Xác thực token Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // 2. Kiểm tra xem người dùng đã tồn tại chưa
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        fullName: name,
        email,
        password: uid, // Sử dụng UID từ Firebase làm mật khẩu giả
        role: "user", // Gán quyền mặc định
        phone: null,
        address: {},
        wishlist: [],
      });
    }

    // 3. Tạo JWT token cho ứng dụng
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h", algorithm: "HS256" }
    );

    // 4. Trả về JWT token và thông tin người dùng
    res.status(200).json({ token, user });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ message: "Invalid Google Token" });
  }
});

module.exports = router;
