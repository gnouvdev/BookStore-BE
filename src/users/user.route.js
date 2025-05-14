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

// Đăng ký người dùng
router.post("/register", async (req, res) => {
  const { uid, email, fullName, password, photo } = req.body;
  console.log("Received data:", req.body);
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = new User({
      firebaseId: uid,
      email,
      fullName,
      password,
      photo,
      role: "user",
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error saving user to database:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
});

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

module.exports = router;
