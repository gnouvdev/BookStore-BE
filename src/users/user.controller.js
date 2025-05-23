const User = require("./user.model");
const Order = require("../orders/order.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET_KEY;

// Đăng ký
const register = async (req, res) => {
  const { fullName, email, password, phone, address } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role: "user",
      phone,
      address,
      wishlist: [],
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};

// Đăng nhập người dùng
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Login failed" });
  }
};

// Đăng nhập admin
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  console.log("Admin login attempt for email:", email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("Admin login failed: Email not found");
      return res.status(401).json({ message: "Email không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Admin login failed: Invalid password");
      return res.status(401).json({ message: "Mật khẩu không đúng" });
    }

    if (user.role !== "admin") {
      console.log("Admin login failed: User is not an admin");
      return res.status(403).json({ message: "Không phải tài khoản admin" });
    }

    console.log("Admin login successful, generating token");
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "7d",
        algorithm: "HS256",
      }
    );

    console.log("Admin token generated successfully");
    res.status(200).json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập admin:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// Lấy thông tin người dùng
const getUserProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId, "-password").populate({
      path: "wishlist",
      select: "_id title description coverImage price author",
      model: "Book", // Thêm model name
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res
      .status(200)
      .json({ message: "User profile fetched successfully", user });
  } catch (error) {
    console.error("Get User Profile Error:", error);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

// Cập nhật thông tin người dùng
const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullName, email, phone, address, photoURL } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fullName, email, phone, address, photoURL },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update Profile Error:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Invalid data provided", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// Thêm sách yêu thích
const addWishlist = async (req, res) => {
  const userId = req.user.id;
  const { bookId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user.wishlist.includes(bookId)) {
      user.wishlist.push(bookId);
      await user.save();
    }

    res
      .status(200)
      .json({ message: "Book added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error("Add Wishlist Error:", error);
    res.status(500).json({ message: "Failed to add to wishlist" });
  }
};

// Xóa sách khỏi danh sách yêu thích
const removeFromWishlist = async (req, res) => {
  const userId = req.user.id;
  const { bookId } = req.body;

  try {
    const user = await User.findById(userId);
    user.wishlist = user.wishlist.filter((id) => id.toString() !== bookId);
    await user.save();

    res
      .status(200)
      .json({ message: "Book removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error("Remove from Wishlist Error:", error);
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
};

// Lấy danh sách tất cả người dùng
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password");

    const usersWithOrdersCount = await Promise.all(
      users.map(async (user) => {
        const ordersCount = await Order.countDocuments({ userId: user._id });
        return { ...user.toObject(), ordersCount };
      })
    );

    res.status(200).json({
      message: "Users fetched successfully",
      users: usersWithOrdersCount,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Tìm kiếm người dùng
const searchUsers = async (req, res) => {
  const { query } = req.query;

  try {
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const users = await User.find(
      {
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      },
      "-password"
    ).sort({ createdAt: -1 });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    const usersWithOrdersCount = await Promise.all(
      users.map(async (user) => {
        const ordersCount = await Order.countDocuments({ userId: user._id });
        return { ...user.toObject(), ordersCount };
      })
    );

    res
      .status(200)
      .json({ message: "Search results", users: usersWithOrdersCount });
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
};

// Cập nhật thông tin người dùng (admin)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, role } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { fullName, email, role },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

// Xóa người dùng
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

module.exports = {
  register,
  login,
  loginAdmin,
  getUserProfile,
  updateProfile,
  addWishlist,
  removeFromWishlist,
  getAllUsers,
  searchUsers,
  updateUser,
  deleteUser,
};
