const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const firebaseAdmin = require("firebase-admin");
const path = require("path");
const User = require("./src/users/user.model"); // ✅ import User model
require("dotenv").config();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://book-app-frontend-tau.vercel.app",
    ],
    credentials: true,
  })
);

// MongoDB connect & start server
async function main() {
  await mongoose.connect(process.env.DB_URL);
  app.listen(port, () => {
    console.log(`Book Store backend listening on port ${port}`);
  });
}
main()
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));

// 📌 Route: test
app.get("/", (req, res) => {
  res.send("Book Store Server is running!");
});

// Routes (other features)
const bookRoutes = require("./src/books/book.route");
const orderRoutes = require("./src/orders/order.route");
const userRoutes = require("./src/users/user.route");
const adminRoutes = require("./src/stats/admin.stats");
const authorRoutes = require("./src/authors/author.route");
const categoryRoutes = require("./src/categories/category.route");
const authRoutes = require("./src/authention/auth.route");
const recommendationRoutes = require("./src/recommened/recommendation.route");
const cartRoutes = require("./src/cart/cart.route");
const paymentRoutes = require("./src/payments/payment.route");
// ✅ Mount routes
app.use("/api/books", bookRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes); // Gắn user.route.js vào "/api/users"
app.use("/api/admin", adminRoutes);
app.use("/api/authors", authorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
