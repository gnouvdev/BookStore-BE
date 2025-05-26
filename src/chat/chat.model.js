const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tối ưu truy vấn
chatSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
chatSchema.index({ senderRole: 1, receiverRole: 1 });

module.exports = mongoose.model("Chat", chatSchema);
