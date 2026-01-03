const socketIO = require("socket.io");
const admin = require("../authention/firebaseAdmin");

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: "https://bookstore-be-qg3u.onrender.com", // Frontend URL
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
    console.log("[Backend Socket] User connected:", socket.id);
    console.log("[Backend Socket] User ID:", socket.userId);

    // Tự động join chat room khi connect (fallback)
    if (socket.userId) {
      const chatRoom = `chat:${socket.userId}`;
      socket.join(chatRoom);
      const room = io.sockets.adapter.rooms.get(chatRoom);
      const roomSize = room ? room.size : 0;
      console.log(
        `[Backend Socket] Auto-joined user to chat room: ${chatRoom}, clients in room: ${roomSize}`
      );
    }

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
        console.log(`[Backend Socket] joinChat event received:`, {
          socketId: socket.id,
          socketUserId: socket.userId,
          requestedUserId: userId,
        });

        if (!userId) {
          console.error("[Backend Socket] joinChat: userId is missing");
          if (callback) callback({ error: "userId is required" });
          return;
        }

        const roomName = `chat:${userId}`;
        socket.join(roomName);

        // Kiểm tra số lượng clients trong room sau khi join
        const room = io.sockets.adapter.rooms.get(roomName);
        const roomSize = room ? room.size : 0;

        console.log(
          `[Backend Socket] User ${socket.userId} joined chat room: ${roomName}, clients in room: ${roomSize}`
        );

        if (callback) callback({ success: true, room: roomName });
      } catch (error) {
        console.error("[Backend Socket] Error in joinChat handler:", error);
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
