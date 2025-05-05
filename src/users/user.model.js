const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    firebaseId: { type: String, required: true, unique: true },
    fullName: {
      type: String,
      required: false, // Có thể không cần với người dùng Google
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: false, // Có thể không có nếu dùng Google
    },
    photo: {
      type: String, // Ảnh đại diện Google (nếu có)
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    phone: {
      type: Number,
    },
    address: {
      street: String,
      city: String,
      country: String,
      zip: String,
    },
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash mật khẩu trước khi lưu (nếu có)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
