const Chat = require("./chat.model");
const User = require("../users/user.model");

// Lấy lịch sử chat giữa 2 người dùng
const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.firebaseId;
    const currentUserRole = req.user.role;

    const messages = await Chat.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(50);

    // Đánh dấu tin nhắn chưa đọc là đã đọc
    await Chat.updateMany(
      {
        senderId: userId,
        receiverId: currentUserId,
        isRead: false,
      },
      { isRead: true }
    );

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

    const newMessage = new Chat({
      senderId,
      receiverId,
      message,
      senderRole,
    });

    console.log("Creating new message:", newMessage);

    await newMessage.save();

    // Gửi tin nhắn qua socket
    const io = req.app.get("io");
    if (!io) {
      console.error("Socket.io instance not found");
      // Vẫn trả về thành công vì tin nhắn đã được lưu
      return res.status(201).json({ data: newMessage });
    }

    io.to(`chat:${receiverId}`).emit("newMessage", {
      message: newMessage,
    });

    console.log("Message saved and emitted successfully");

    res.status(201).json({ data: newMessage });
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
