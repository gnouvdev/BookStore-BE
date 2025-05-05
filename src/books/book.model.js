const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Author",
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  }, // Tham chiếu đến Category
  coverImage: { type: String, required: true },
  price: {
    oldPrice: { type: Number, required: true }, // Giá cũ (float)
    newPrice: { type: Number, required: true }, // Giá mới (float)
  },
  quantity: { type: Number, required: true },
  trending: { type: Boolean, default: false },
  language: {
    type: String,
    enum: ["Tiếng Anh", "Tiếng Việt"], // Chỉ cho phép 2 giá trị
    required: true,
    default: "Tiếng Anh", // Giá trị mặc định
  },
  tags: [{ type: String }], // Mảng các chuỗi
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Book", bookSchema);
