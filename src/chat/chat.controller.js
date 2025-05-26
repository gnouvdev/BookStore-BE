const Chat = require("./chat.model");
const User = require("../users/user.model");

// Lấy lịch sử chat giữa 2 người dùng
const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.firebaseId;
    const currentUserRole = req.user.role;

    console.log("Getting chat history:", {
      userId,
      currentUserId,
      currentUserRole,
    });

    // Xử lý đặc biệt cho chat với admin
    const isAdminChat = userId === "admin";
    const query = isAdminChat
      ? {
          $or: [
            { senderId: currentUserId, receiverId: "admin" },
            { senderId: "admin", receiverId: currentUserId },
          ],
        }
      : {
          $or: [
            { senderId: currentUserId, receiverId: userId },
            { senderId: userId, receiverId: currentUserId },
          ],
        };

    console.log("Chat query:", query);

    const messages = await Chat.find(query).sort({ createdAt: 1 }).limit(50);

    console.log("Found messages:", messages.length);

    // Đánh dấu tin nhắn chưa đọc là đã đọc
    const updateQuery = isAdminChat
      ? {
          senderId: "admin",
          receiverId: currentUserId,
          isRead: false,
        }
      : {
          senderId: userId,
          receiverId: currentUserId,
          isRead: false,
        };

    await Chat.updateMany(updateQuery, { isRead: true });

    res.status(200).json({ data: messages });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({ message: error.message });
  }
};

// Gửi tin nhắn mới
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.firebaseId;
    const senderRole = req.user.role;

    console.log("Send message request:", {
      receiverId,
      message,
      senderId,
      senderRole,
      user: req.user,
    });

    if (!receiverId || !message || !senderId) {
      console.error("Missing required fields:", {
        receiverId,
        message,
        senderId,
      });
      return res.status(400).json({
        message: "Missing required fields",
        details: { receiverId, message, senderId },
      });
    }

    // Nếu gửi tin nhắn đến admin, sử dụng ID cố định cho admin
    const actualReceiverId = receiverId === "admin" ? "admin" : receiverId;
    const actualReceiverRole = receiverId === "admin" ? "admin" : "user";

    const newMessage = new Chat({
      senderId,
      receiverId: actualReceiverId,
      message,
      senderRole,
      receiverRole: actualReceiverRole, // Thêm receiverRole
    });

    console.log("Creating new message:", newMessage);

    const savedMessage = await newMessage.save();
    console.log("Message saved:", savedMessage);

    // Gửi tin nhắn qua socket
    const io = req.app.get("io");
    if (!io) {
      console.error("Socket.io instance not found");
      return res.status(201).json({ data: savedMessage });
    }

    // Gửi tin nhắn đến cả người gửi và người nhận
    const senderRoom = `chat:${senderId}`;
    const receiverRoom = `chat:${actualReceiverId}`;

    console.log("Emitting to rooms:", { senderRoom, receiverRoom });

    // Gửi tin nhắn đến phòng của người nhận
    io.to(receiverRoom).emit("newMessage", {
      message: savedMessage,
    });

    // Gửi tin nhắn đến phòng của người gửi (để cập nhật UI ngay lập tức)
    io.to(senderRoom).emit("newMessage", {
      message: savedMessage,
    });

    console.log("Message emitted successfully to both rooms");

    res.status(201).json({ data: savedMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      message: error.message,
      details: error.stack,
    });
  }
};

// Lấy danh sách người dùng đã chat
const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user.firebaseId;
    const currentUserRole = req.user.role;

    // Lấy danh sách người dùng đã chat với người dùng hiện tại
    const chatUsers = await Chat.aggregate([
      {
        $match: {
          $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", currentUserId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $last: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "firebaseId",
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: "$_id",
          lastMessage: 1,
          fullName: "$userInfo.fullName",
          email: "$userInfo.email",
          avatar: "$userInfo.avatar",
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);

    res.status(200).json({ data: chatUsers });
  } catch (error) {
    console.error("Error getting chat users:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getChatHistory,
  sendMessage,
  getChatUsers,
};
