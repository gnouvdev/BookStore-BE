const socketIO = require("socket.io");
const admin = require("../authention/firebaseAdmin");

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: "http://localhost:5173", // Frontend URL
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware để xác thực socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      // Xác thực Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      socket.userId = decodedToken.uid;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    console.log("User ID:", socket.userId);

    // Xử lý sự kiện đăng ký phòng
    socket.on("register", (userId) => {
      console.log(`User ${userId} joined room`);
      socket.join(userId);
    });

    // Xử lý sự kiện ngắt kết nối
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });

    // Xử lý lỗi
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};
