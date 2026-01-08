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
      try {
        if (!userId) {
          console.error("Register: userId is missing");
          return;
        }
        console.log(`User ${userId} joined room`);
        socket.join(userId);
      } catch (error) {
        console.error("Error in register handler:", error);
      }
    });

    // Xử lý sự kiện chat
    socket.on("joinChat", (userId, callback) => {
      try {
        if (!userId) {
          console.error("joinChat: userId is missing");
          if (callback) callback({ error: "userId is required" });
          return;
        }

        const roomName = `chat:${userId}`;
        socket.join(roomName);
        console.log(`User ${socket.userId} joined chat room: ${roomName}`);

        if (callback) callback({ success: true, room: roomName });
      } catch (error) {
        console.error("Error in joinChat handler:", error);
        if (callback) callback({ error: error.message });
      }
    });

    socket.on("leaveChat", (userId) => {
      try {
        if (!userId) {
          console.error("leaveChat: userId is missing");
          return;
        }
        const roomName = `chat:${userId}`;
        socket.leave(roomName);
        console.log(`User ${socket.userId} left chat room: ${roomName}`);
      } catch (error) {
        console.error("Error in leaveChat handler:", error);
      }
    });

    // Xử lý sự kiện ngắt kết nối
    socket.on("disconnect", (reason) => {
      console.log("User disconnected:", socket.id, "Reason:", reason);
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
