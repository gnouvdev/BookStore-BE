require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();
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

// Routes
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

app.use("/api/books", bookRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/authors", authorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Book Store Server is running!");
});

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});