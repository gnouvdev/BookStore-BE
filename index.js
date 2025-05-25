require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("./src/authention/firebaseAdmin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://book-app-frontend-tau.vercel.app",
    ],
    credentials: true,
  },
});
const port = process.env.PORT || 5000;

// Lưu io vào app
app.set("io", io);

// Socket.IO middleware để xác thực
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log("No token provided");
      return next(new Error("Authentication error"));
    }

    // Xác thực Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.userId = decodedToken.uid;
    console.log("Socket authenticated for user:", socket.userId);
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error"));
  }
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  console.log("Authenticated user ID:", socket.userId);

  socket.on("register", (userId) => {
    console.log(`User ${userId} attempting to join room`);
    socket.join(userId);
    console.log(`User ${userId} joined room`);

    // Gửi xác nhận đã join room
    socket.emit("roomJoined", {
      userId,
      message: `Successfully joined room ${userId}`,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

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
const reviewRoutes = require("./src/reviews/review.route");
const recommendationv2Routes = require("./src/recommendationv2/recommendationv2.route");
const viewHistoryRoutes = require("./src/viewHistory/viewHistory.routes");
const searchHistoryRoutes = require("./src/searchHistory/searchHistory.routes");
const notificationRoutes = require("./src/notifications/notification.route");

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
app.use("/api/reviews", reviewRoutes);
app.use("/api/recommendationv2", recommendationv2Routes);
app.use("/api/viewHistory", viewHistoryRoutes);
app.use("/api/searchHistory", searchHistoryRoutes);
app.use("/api/notifications", notificationRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Book Store Server is running!");
});

// MongoDB connect & start server
async function main() {
  await mongoose.connect(process.env.DB_URL);
  server.listen(port, () => {
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
