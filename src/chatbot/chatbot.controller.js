const chatbotService = require("./chatbot.service");
const Chat = require("../chat/chat.model");

// Xử lý tin nhắn từ user và trả lời tự động
const handleChatbotMessage = async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    // Xử lý tin nhắn và tạo phản hồi
    const response = await chatbotService.processMessage(
      message.trim(),
      userId || req.user?.firebaseId
    );

    res.status(200).json({
      success: true,
      response: response,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error in handleChatbotMessage:", error);
    res.status(500).json({
      message: "Error processing chatbot message",
      error: error.message,
    });
  }
};

// Gửi tin nhắn đến bot và nhận phản hồi tự động
const sendMessageToBot = async (req, res) => {
  try {
    const { message } = req.body;
    const senderId = req.user.firebaseId;
    const senderRole = req.user.role || "user";
    const botId = "chatbot";

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    // Lưu tin nhắn của user
    const userMessage = new Chat({
      senderId,
      receiverId: botId,
      message: message.trim(),
      senderRole,
      receiverRole: "bot",
      isRead: true,
    });
    await userMessage.save();

    // Xử lý và tạo phản hồi từ bot
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
      senderId: botId,
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
      const botRoom = `chat:${botId}`;

      // Gửi tin nhắn của user
      io.to(userRoom).emit("newMessage", {
        message: userMessage,
      });

      // Gửi phản hồi của bot (có delay nhỏ để tự nhiên hơn)
      setTimeout(() => {
        // Books đã được lưu trong savedBotMessage
        const messageWithBooks = savedBotMessage.toObject();
        console.log("Emitting bot message with books:", {
          messageId: messageWithBooks._id,
          booksCount: messageWithBooks.books?.length || 0,
        });
        io.to(userRoom).emit("newMessage", {
          message: messageWithBooks,
        });
      }, 500);
    }

    res.status(201).json({
      data: {
        userMessage,
        botMessage: savedBotMessage,
      },
    });
  } catch (error) {
    console.error("Error in sendMessageToBot:", error);
    res.status(500).json({
      message: "Error sending message to bot",
      error: error.message,
    });
  }
};

// Lấy lịch sử chat với bot
const getBotChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user.firebaseId;
    const botId = "chatbot";

    const messages = await Chat.find({
      $or: [
        { senderId: currentUserId, receiverId: botId },
        { senderId: botId, receiverId: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(50);

    // Đánh dấu tin nhắn chưa đọc là đã đọc
    await Chat.updateMany(
      {
        senderId: botId,
        receiverId: currentUserId,
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json({ data: messages });
  } catch (error) {
    console.error("Error getting bot chat history:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  handleChatbotMessage,
  sendMessageToBot,
  getBotChatHistory,
};
