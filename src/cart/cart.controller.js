const Cart = require("./cart.model");
const Book = require("../books/book.model");
const { validateObjectId } = require("../utils/validateObjectId");

// Get cart by user ID
exports.getCartByUserId = async (req, res) => {
  try {
    const firebaseId = req.user.id;
    console.log("Getting cart for user:", firebaseId);

    let cart = await Cart.findOne({
      $or: [{ user: req.user.id }, { firebaseId: firebaseId }],
    }).populate("items.book");

    if (!cart) {
      // Tạo giỏ hàng mới nếu chưa có
      cart = await Cart.create({
        user: req.user.id,
        firebaseId: firebaseId,
        items: [],
      });
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const firebaseId = req.user.id;

    if (!validateObjectId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    // Kiểm tra sách tồn tại và lấy giá
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Lấy giá mới của sách
    const price = book.price.newPrice || book.price.oldPrice;
    if (!price) {
      return res.status(400).json({
        success: false,
        message: "Book price not available",
      });
    }

    // Tìm hoặc tạo giỏ hàng
    let cart = await Cart.findOne({
      $or: [{ user: req.user.id }, { firebaseId: firebaseId }],
    });

    if (!cart) {
      cart = await Cart.create({
        user: req.user.id,
        firebaseId: firebaseId,
        items: [],
      });
    }

    // Kiểm tra sách đã có trong giỏ hàng chưa
    const existingItem = cart.items.find(
      (item) => item.book.toString() === bookId
    );

    if (existingItem) {
      // Cập nhật số lượng và giá nếu đã có
      existingItem.quantity += quantity;
      existingItem.price = price; // Cập nhật giá mới
    } else {
      // Thêm mới nếu chưa có
      cart.items.push({
        book: bookId,
        quantity,
        price, // Thêm giá vào item mới
      });
    }

    await cart.save();
    await cart.populate("items.book");

    res.status(200).json({
      success: true,
      data: cart,
      message: "Item added to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const firebaseId = req.user.id;

    if (!validateObjectId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const cart = await Cart.findOne({
      $or: [{ user: req.user.id }, { firebaseId: firebaseId }],
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.book.toString() === bookId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    if (quantity <= 0) {
      // Xóa item nếu số lượng <= 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Cập nhật số lượng
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    await cart.populate("items.book");

    res.status(200).json({
      success: true,
      data: cart,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { bookId } = req.params;
    const firebaseId = req.user.id;

    if (!validateObjectId(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const cart = await Cart.findOne({
      $or: [{ user: req.user.id }, { firebaseId: firebaseId }],
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter((item) => item.book.toString() !== bookId);

    await cart.save();
    await cart.populate("items.book");

    res.status(200).json({
      success: true,
      data: cart,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const firebaseId = req.user.id;

    const cart = await Cart.findOne({
      $or: [{ user: req.user.id }, { firebaseId: firebaseId }],
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
