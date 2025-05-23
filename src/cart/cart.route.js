const express = require("express");
const router = express.Router();
const {
  getCartByUserId: getCart,
  addToCart,
  clearCart,
  updateCartItem: updateCartItemQuantity,
  removeFromCart,
} = require("./cart.controller");
const verifyToken = require("../middleware/verifyToken");

// Debug log to check if functions are imported correctly
console.log("Controller functions:", {
  getCart,
  addToCart,
  clearCart,
  updateCartItemQuantity,
});

router.get("/", verifyToken, getCart);
router.post("/", verifyToken, addToCart);
router.delete("/", verifyToken, clearCart);
router.patch("/:bookId", verifyToken, updateCartItemQuantity);
router.delete("/:bookId", verifyToken, removeFromCart);

module.exports = router;
