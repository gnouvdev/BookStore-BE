const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("./notification.controller");

// Get all notifications for the current user
router.get("/", verifyToken, getNotifications);

// Mark a notification as read
router.put("/:id/read", verifyToken, markAsRead);

// Mark all notifications as read
router.put("/read-all", verifyToken, markAllAsRead);

module.exports = router;
