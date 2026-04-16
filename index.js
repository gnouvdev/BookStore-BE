require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("./src/authention/firebaseAdmin");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
const port = process.env.PORT || 5000;

app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  socket.on("register", (userId) => {
    if (userId && userId === socket.userId) {
      socket.join(userId);
      socket.emit("roomJoined", {
        userId,
        message: `Successfully joined room ${userId}`,
      });
    }
  });

  socket.on("disconnect", () => {});
});

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

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
const chatRoutes = require("./src/chat/chat.route");
const chatbotRoutes = require("./src/chatbot/chatbot.route");
const dashboardRoutes = require("./src/dashboard/dashboard.route");
const voucherRoutes = require("./vouchers/voucher.routes");

app.use("/api/books", bookRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/users", userRoutes);
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
app.use("/api/chat", chatRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/vouchers", voucherRoutes);

app.get("/", (req, res) => {
  res.send("Book Store Server is running!");
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

async function main() {
  if (!process.env.DB_URL) {
    throw new Error("DB_URL is required");
  }

  await mongoose.connect(process.env.DB_URL);
  server.listen(port, () => {
    console.log(`Book Store backend listening on port ${port}`);
  });
}

main()
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));
