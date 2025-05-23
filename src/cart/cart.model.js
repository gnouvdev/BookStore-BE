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

// Function to reset cart collection
const resetCartCollection = async () => {
  try {
    // Drop the collection
    await Cart.collection.drop();
    console.log("Cart collection dropped successfully");

    // Create new indexes
    await Cart.createIndexes();
    console.log("Cart indexes created successfully");
  } catch (error) {
    if (error.code === 26) {
      // Collection doesn't exist, that's fine
      console.log("Cart collection doesn't exist, creating new one");
      await Cart.createIndexes();
      console.log("Cart indexes created successfully");
    } else {
      console.error("Error resetting cart collection:", error);
      throw error;
    }
  }
};

// Call resetCartCollection when the model is initialized
resetCartCollection();

module.exports = Cart;
