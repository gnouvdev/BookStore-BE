const Cart = require("./cart.model");
const Book = require("../books/book.model");

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate({
      path: "items.bookId",
      select: "title coverImage price.newPrice",
    });
    if (!cart) {
      return res.status(200).json({ items: [], totalAmount: 0 });
    }
    const items = cart.items.map((item) => ({
      bookId: item.bookId._id,
      title: item.bookId.title,
      coverImage: item.bookId.coverImage,
      price: item.price,
      quantity: item.quantity,
    }));
    const totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    console.log("Cart fetched:", { userId: req.user.id, items });
    res.status(200).json({ items, totalAmount });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const addToCart = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    if (book.quantity < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    const existingItem = cart.items.find((item) => item.bookId.toString() === bookId);
    if (existingItem) {
      if (book.quantity < existingItem.quantity + quantity) {
        return res.status(400).json({ message: "Insufficient stock" });
      }
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ bookId, quantity, price: book.price.newPrice });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    console.log("Cart updated:", { userId: req.user.id, bookId });
    res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const clearCart = async (req, res) => {
  try {
    await Cart.deleteOne({ userId: req.user.id });
    console.log("Cart cleared:", { userId: req.user.id });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    console.log("Removing item:", { userId: req.user.id, bookId: req.params.bookId });
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const itemExists = cart.items.some((item) => item.bookId.toString() === req.params.bookId);
    if (!itemExists) {
      return res.status(404).json({ message: "Item not in cart" });
    }
    cart.items = cart.items.filter((item) => item.bookId.toString() !== req.params.bookId);
    cart.updatedAt = Date.now();
    await cart.save();
    console.log("Cart after remove:", cart);
    res.status(200).json({ message: "Item removed", cart });
  } catch (error) {
    console.error("Error removing item:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateCartItemQuantity = async (req, res) => {
  try {
    const { quantity } = req.body;
    console.log("Updating quantity:", { userId: req.user.id, bookId: req.params.bookId, quantity });
    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }
    const book = await Book.findById(req.params.bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    if (book.quantity < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const item = cart.items.find((item) => item.bookId.toString() === req.params.bookId);
    if (!item) {
      return res.status(404).json({ message: "Item not in cart" });
    }
    item.quantity = quantity;
    item.price = book.price.newPrice; // Cập nhật giá nếu cần
    cart.updatedAt = Date.now();
    await cart.save();
    console.log("Cart after update quantity:", cart);
    res.status(200).json({ message: "Quantity updated", cart });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getCart, addToCart, clearCart, removeFromCart, updateCartItemQuantity };