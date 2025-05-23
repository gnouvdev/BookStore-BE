const ViewHistory = require("./viewHistory.model");
const mongoose = require("mongoose");
const User = require("../users/user.model");

exports.addView = async (req, res) => {
  try {
    // Log chi tiết request
    console.log("=== View History Request Debug ===");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("User from token:", req.user);
    console.log("Request URL:", req.originalUrl);
    console.log("Request method:", req.method);
    console.log("================================");

    const { userId, bookId } = req.body;
    if (!userId || !bookId) {
      console.log("Missing data:", { userId, bookId });
      return res.status(400).json({ message: "Missing userId or bookId" });
    }

    // First, find the user by their Firebase ID
    const user = await User.findOne({ firebaseId: userId });
    if (!user) {
      console.error("User not found with Firebase ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Convert book ID to ObjectId
    let bookObjectId;
    try {
      bookObjectId = new mongoose.Types.ObjectId(bookId);
    } catch (error) {
      console.error("Invalid book ID format:", error);
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    // Log trước khi tạo
    console.log("Creating view history with:", {
      user: user._id,
      book: bookObjectId,
      timestamp: new Date(),
    });

    const view = await ViewHistory.create({
      user: user._id, // Use the MongoDB _id from the found user
      book: bookObjectId,
      timestamp: new Date(),
    });

    // Log sau khi tạo thành công
    console.log("View history created successfully:", view);

    res.status(201).json({ data: view });
  } catch (error) {
    console.error("Error adding view:", error);
    // Log chi tiết lỗi
    if (error.name === "ValidationError") {
      console.error("Validation Error Details:", error.errors);
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
