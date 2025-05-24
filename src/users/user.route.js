const express = require("express");
const router = express.Router();
const User = require("./user.model"); // Sửa đường dẫn
const {
  register,
  login,
  loginAdmin, // Thêm hàm mới
  getUserProfile,
  updateProfile,
  addWishlist,
  removeFromWishlist,
  getAllUsers,
  searchUsers,
  updateUser,
  deleteUser,
} = require("./user.controller");
const verifyToken = require("../middleware/verifyToken");
const jwt = require("jsonwebtoken");

// Đăng ký người dùng
router.post("/register", async (req, res) => {
  const { idToken, fullName, email } = req.body;
  console.log("Received data:", req.body);
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = new User({
      firebaseId: idToken, // Sử dụng idToken làm firebaseId
      email,
      fullName,
      role: "user",
    });

    await newUser.save();

    // Tạo JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "100y" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error saving user to database:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
});
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseId: req.user.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ data: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
router.get("/me", verifyToken, getCurrentUser);

// Đăng nhập người dùng
router.post("/login", login);

// Đăng nhập admin
router.post("/admin", loginAdmin);

// Profile routes
router.get("/profile", verifyToken, getUserProfile);
router.put("/profile", verifyToken, updateProfile);

// Wishlist routes
router.post("/wishlist", verifyToken, addWishlist);
router.delete("/wishlist", verifyToken, removeFromWishlist);

// Other routes
router.get("/", verifyToken, getAllUsers);
router.get("/search", verifyToken, searchUsers);
router.put("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

const verifyTokenHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ valid: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ valid: false, message: "User not found" });
    }

    res.json({ valid: true, user: { id: user._id, role: user.role } });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ valid: false, message: "Invalid token" });
  }
};

// Add the new route
router.get("/verify-token", verifyTokenHandler);

module.exports = router;
