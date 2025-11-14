const Chat = require("./chat.model");
const User = require("../users/user.model");
const chatbotService = require("../chatbot/chatbot.service");

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

    // Xử lý đặc biệt cho chat với admin hoặc chatbot
    const isAdminChat = userId === "admin";
    const isBotChat = userId === "chatbot";
    const query = isAdminChat
      ? {
          $or: [
            { senderId: currentUserId, receiverId: "admin" },
            { senderId: "admin", receiverId: currentUserId },
          ],
        }
      : isBotChat
      ? {
          $or: [
            { senderId: currentUserId, receiverId: "chatbot" },
            { senderId: "chatbot", receiverId: currentUserId },
          ],
        }
      : {
          $or: [
            { senderId: currentUserId, receiverId: userId },
            { senderId: userId, receiverId: currentUserId },
          ],
        };

    console.log("Chat query:", query);

    const messages = await Chat.find(query)
      .sort({ createdAt: 1 })
      .limit(50)
      .lean(); // Sử dụng lean() để trả về plain objects

    console.log("Found messages:", messages.length);
    console.log(
      "Sample message with books:",
      messages.find((m) => m.books && m.books.length > 0)
    );

    // Đánh dấu tin nhắn chưa đọc là đã đọc
    const updateQuery = isAdminChat
      ? {
          senderId: "admin",
          receiverId: currentUserId,
          isRead: false,
        }
      : isBotChat
      ? {
          senderId: "chatbot",
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

    // Nếu gửi tin nhắn đến admin hoặc chatbot, sử dụng ID cố định
    const actualReceiverId =
      receiverId === "admin"
        ? "admin"
        : receiverId === "chatbot"
        ? "chatbot"
        : receiverId;
    const actualReceiverRole =
      receiverId === "admin"
        ? "admin"
        : receiverId === "chatbot"
        ? "bot"
        : "user";

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

    // Nếu gửi tin nhắn đến chatbot, tự động tạo phản hồi
    if (actualReceiverId === "chatbot") {
      try {
        const botResponse = await chatbotService.processMessage(
          message.trim(),
          senderId
        );

        // Xử lý response từ bot (có thể là object hoặc string)
        let botResponseText = "";
        let botResponseBooks = [];

        if (typeof botResponse === "object" && botResponse !== null) {
          botResponseText = botResponse.text || "";
          botResponseBooks = botResponse.books || [];
        } else {
          botResponseText = botResponse || "";
        }

        // Lưu phản hồi của bot (lưu cả text và books)
        const botMessage = new Chat({
          senderId: "chatbot",
          receiverId: senderId,
          message: botResponseText,
          senderRole: "bot",
          receiverRole: senderRole,
          isRead: false,
          books: botResponseBooks || [], // Lưu books vào database
        });
        const savedBotMessage = await botMessage.save();

        console.log("Bot message saved with books:", {
          messageId: savedBotMessage._id,
          booksCount: savedBotMessage.books?.length || 0,
        });

        // Gửi tin nhắn qua socket
        const io = req.app.get("io");
        if (io) {
          const userRoom = `chat:${senderId}`;

          // Gửi tin nhắn của user
          io.to(userRoom).emit("newMessage", {
            message: savedMessage,
          });

          // Gửi phản hồi của bot (có delay nhỏ để tự nhiên hơn)
          setTimeout(() => {
            // Books đã được lưu trong savedBotMessage khi save
            const messageWithBooks = savedBotMessage.toObject();
            console.log("Emitting bot message with books:", {
              messageId: messageWithBooks._id,
              booksCount: messageWithBooks.books?.length || 0,
              hasBooks: !!messageWithBooks.books,
            });
            io.to(userRoom).emit("newMessage", {
              message: messageWithBooks,
            });
          }, 500);
        }

        // Đảm bảo books được trả về trong response
        const responseData = {
          userMessage: savedMessage.toObject
            ? savedMessage.toObject()
            : savedMessage,
          botMessage: savedBotMessage.toObject
            ? savedBotMessage.toObject()
            : savedBotMessage,
        };

        console.log("Response data with books:", {
          botMessageId: responseData.botMessage._id,
          booksCount: responseData.botMessage.books?.length || 0,
          hasBooks: !!responseData.botMessage.books,
        });

        return res.status(201).json({
          data: responseData,
        });
      } catch (botError) {
        console.error("Error processing chatbot response:", botError);
        // Nếu bot lỗi, vẫn trả về tin nhắn của user
      }
    }

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
