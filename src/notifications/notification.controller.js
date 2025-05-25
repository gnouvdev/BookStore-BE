const Notification = require("./notification.model");

// Get all notifications for a user
const getNotifications = async (req, res) => {
  try {
    console.log("Getting notifications for user:", req.user.firebaseId);
    const notifications = await Notification.find({
      userId: req.user.firebaseId,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log("Found notifications:", notifications);
    res.status(200).json({ data: notifications });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ message: error.message });
  }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.firebaseId },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json({ data: notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: error.message });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.firebaseId, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create a new notification
const createNotification = async (userId, message, type, metadata) => {
  try {
    console.log("Creating notification with userId:", userId);
    const notification = new Notification({
      userId,
      message,
      type,
      data: metadata,
    });
    await notification.save();
    console.log("Notification created:", notification);
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
};
