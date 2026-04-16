const mongoose = require("mongoose");
const Payment = require("../payments/payment.model");

const BOOK_PROJECTION = "title quantity price";

const normalizeAddress = (address = {}) => ({
  street: address.street || "",
  city: address.city || "",
  country: address.country || "",
  state: address.state || "",
  zipcode: address.zipcode || address.zip || "",
});

const validateCheckoutPayload = ({ name, email, phone, address, productIds }) => {
  if (!name || !email || !phone) {
    throw new Error("Missing required customer information");
  }

  if (!address || !address.city) {
    throw new Error("Shipping address is required");
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("Order must include at least one product");
  }
};

const getBooksByIds = async (productIds) => {
  const uniqueIds = [...new Set(productIds.map((item) => item.productId?.toString()))];
  const books = await mongoose.model("Book").find(
    { _id: { $in: uniqueIds } },
    BOOK_PROJECTION
  );

  return new Map(books.map((book) => [book._id.toString(), book]));
};

const calculateOrderTotals = async (productIds, paymentMethodId) => {
  const paymentMethod = await Payment.findById(paymentMethodId);
  if (!paymentMethod || !paymentMethod.isActive) {
    throw new Error("Invalid payment method");
  }

  const booksById = await getBooksByIds(productIds);

  let subtotal = 0;
  const normalizedItems = productIds.map((item) => {
    const productId = item.productId?.toString();
    const quantity = Number(item.quantity) || 0;

    if (!productId || quantity < 1) {
      throw new Error("Invalid order item");
    }

    const book = booksById.get(productId);
    if (!book) {
      throw new Error(`Book not found: ${productId}`);
    }

    if (book.quantity < quantity) {
      throw new Error(`Insufficient stock for book: ${book.title}`);
    }

    const unitPrice =
      typeof book.price?.newPrice === "number" ? book.price.newPrice : Number(book.price) || 0;
    subtotal += unitPrice * quantity;

    return {
      productId: book._id,
      quantity,
    };
  });

  return {
    paymentMethod,
    normalizedItems,
    subtotal,
  };
};

const reserveInventory = async (productIds) => {
  for (const item of productIds) {
    const updateResult = await mongoose.model("Book").updateOne(
      {
        _id: item.productId,
        quantity: { $gte: item.quantity },
      },
      {
        $inc: { quantity: -item.quantity },
      }
    );

    if (!updateResult.modifiedCount) {
      throw new Error(`Failed to reserve stock for product ${item.productId}`);
    }
  }
};

const releaseInventory = async (productIds) => {
  for (const item of productIds) {
    await mongoose.model("Book").updateOne(
      { _id: item.productId },
      { $inc: { quantity: item.quantity } }
    );
  }
};

module.exports = {
  calculateOrderTotals,
  normalizeAddress,
  releaseInventory,
  reserveInventory,
  validateCheckoutPayload,
};
