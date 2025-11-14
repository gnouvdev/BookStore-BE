const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  handleChatbotMessage,
  sendMessageToBot,
  getBotChatHistory,
} = require("./chatbot.controller");

// API để xử lý tin nhắn chatbot (có thể dùng không cần auth cho testing)
router.post("/message", handleChatbotMessage);

// API để gửi tin nhắn đến bot và nhận phản hồi tự động (cần auth)
router.post("/send", verifyToken, sendMessageToBot);

// API để lấy lịch sử chat với bot (cần auth)
router.get("/history", verifyToken, getBotChatHistory);

module.exports = router;
