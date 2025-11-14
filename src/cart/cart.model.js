const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  firebaseId: {
    type: String,
    required: true,
  },
  items: [
    {
      book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
        required: true,
      },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true }, // Giá tại thời điểm thêm
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});

// Compound index to ensure one cart per user
cartSchema.index({ user: 1, firebaseId: 1 }, { unique: true });

const Cart = mongoose.model("Cart", cartSchema);

// Function to reset cart collection - chỉ gọi khi cần thiết
const resetCartCollection = async () => {
  try {
    // Đợi MongoDB kết nối
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once("connected", resolve);
      });
    }

    // Kiểm tra xem collection có tồn tại không
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionExists = collections.some((col) => col.name === "carts");

    if (collectionExists) {
      // Drop the collection
      await Cart.collection.drop();
      console.log("Cart collection dropped successfully");
    }

    // Create new indexes
    await Cart.createIndexes();
    console.log("Cart indexes created successfully");
  } catch (error) {
    if (error.code === 26 || error.message?.includes("not found")) {
      // Collection doesn't exist, that's fine
      console.log("Cart collection doesn't exist, creating new one");
      try {
        await Cart.createIndexes();
        console.log("Cart indexes created successfully");
      } catch (indexError) {
        console.error("Error creating cart indexes:", indexError);
      }
    } else {
      console.error("Error resetting cart collection:", error);
      // Không throw error để không crash server
    }
  }
};

// KHÔNG tự động gọi resetCartCollection khi module load
// Chỉ gọi khi cần thiết (ví dụ: trong script migration hoặc admin route)
// resetCartCollection();

module.exports = Cart;
