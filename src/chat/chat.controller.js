const Chat = require("./chat.model");
const chatbotService = require("../chatbot/chatbot.service");

const buildChatQuery = (currentUserId, userId) => {
  const isAdminChat = userId === "admin";
  const isBotChat = userId === "chatbot";

  if (isAdminChat) {
    return {
      $or: [
        { senderId: currentUserId, receiverId: "admin" },
        { senderId: "admin", receiverId: currentUserId },
      ],
    };
  }

  if (isBotChat) {
    return {
      $or: [
        { senderId: currentUserId, receiverId: "chatbot" },
        { senderId: "chatbot", receiverId: currentUserId },
      ],
    };
  }

  return {
    $or: [
      { senderId: currentUserId, receiverId: userId },
      { senderId: userId, receiverId: currentUserId },
    ],
  };
};

const buildUnreadQuery = (currentUserId, userId) => {
  if (userId === "admin") {
    return { senderId: "admin", receiverId: currentUserId, isRead: false };
  }

  if (userId === "chatbot") {
    return { senderId: "chatbot", receiverId: currentUserId, isRead: false };
  }

  return { senderId: userId, receiverId: currentUserId, isRead: false };
};

const sendSocketMessage = (io, room, message) => {
  if (!io) return;
  io.to(room).emit("newMessage", { message });
};

const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.firebaseId;

    const messages = await Chat.find(buildChatQuery(currentUserId, userId))
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    messages.reverse();

    await Chat.updateMany(buildUnreadQuery(currentUserId, userId), {
      isRead: true,
    });

    res.status(200).json({ data: messages });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.firebaseId;
    const senderRole = req.user.role;

    if (!receiverId || !message || !senderId) {
      return res.status(400).json({
        message: "Missing required fields",
        details: { receiverId, message, senderId },
      });
    }

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
      receiverRole: actualReceiverRole,
    });

    const savedMessage = await newMessage.save();
    const io = req.app.get("io");

    if (actualReceiverId === "chatbot") {
      try {
        const botResponse = await chatbotService.processMessage(
          message.trim(),
          senderId
        );

        let botResponseText = "";
        let botResponseBooks = [];
        let redirectTo = null;

        if (typeof botResponse === "object" && botResponse !== null) {
          botResponseText =
            botResponse.text ||
            "Xin loi, toi khong the tra loi cau hoi nay ngay luc nay.";
          botResponseBooks = Array.isArray(botResponse.books)
            ? botResponse.books
            : [];
          redirectTo = botResponse.redirectTo || null;
        } else if (typeof botResponse === "string") {
          botResponseText = botResponse;
        } else {
          botResponseText =
            "Xin loi, toi khong the tra loi cau hoi nay ngay luc nay.";
        }

        const botMessage = new Chat({
          senderId: "chatbot",
          receiverId: senderId,
          message: botResponseText,
          senderRole: "bot",
          receiverRole: senderRole,
          isRead: false,
          books: botResponseBooks,
          redirectTo,
          actionButtons: botResponse?.actionButtons || [],
        });

        const savedBotMessage = await botMessage.save();
        const userRoom = `chat:${senderId}`;

        sendSocketMessage(
          io,
          userRoom,
          savedMessage.toObject ? savedMessage.toObject() : savedMessage
        );
        sendSocketMessage(io, userRoom, savedBotMessage.toObject());

        return res.status(201).json({
          data: {
            userMessage: savedMessage.toObject
              ? savedMessage.toObject()
              : savedMessage,
            botMessage: savedBotMessage.toObject(),
          },
        });
      } catch (botError) {
        console.error("Error processing chatbot response:", botError);

        const errorBotMessage = new Chat({
          senderId: "chatbot",
          receiverId: senderId,
          message:
            "Xin loi, toi gap loi khi xu ly tin nhan cua ban. Vui long thu lai sau.",
          senderRole: "bot",
          receiverRole: senderRole || "user",
          isRead: false,
          books: [],
        });

        const savedErrorBotMessage = await errorBotMessage.save();
        const userRoom = `chat:${senderId}`;

        sendSocketMessage(
          io,
          userRoom,
          savedMessage.toObject ? savedMessage.toObject() : savedMessage
        );
        sendSocketMessage(io, userRoom, savedErrorBotMessage.toObject());

        return res.status(201).json({
          data: {
            userMessage: savedMessage.toObject
              ? savedMessage.toObject()
              : savedMessage,
            botMessage: savedErrorBotMessage.toObject(),
          },
        });
      }
    }

    if (!io) {
      return res.status(201).json({ data: savedMessage });
    }

    sendSocketMessage(io, `chat:${actualReceiverId}`, savedMessage);
    sendSocketMessage(io, `chat:${senderId}`, savedMessage);

    res.status(201).json({ data: savedMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      message: error.message,
      details: error.stack,
    });
  }
};

const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user.firebaseId;

    const chatUsers = await Chat.aggregate([
      {
        $match: {
          $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
        },
      },
      {
        $sort: { createdAt: 1 },
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
