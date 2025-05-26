const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  getChatHistory,
  sendMessage,
  getChatUsers,
} = require("./chat.controller");

// Lấy lịch sử chat với một người dùng
router.get("/history/:userId", verifyToken, getChatHistory);

// Gửi tin nhắn mới
router.post("/send", verifyToken, sendMessage);

// Lấy danh sách người dùng đã chat
router.get("/users", verifyToken, getChatUsers);

module.exports = router;
