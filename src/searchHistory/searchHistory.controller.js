const SearchHistory = require("./searchHistory.model");
const mongoose = require("mongoose");
const User = require("../users/user.model");

const normalizeQuery = (value = "") => value.trim().replace(/\s+/g, " ");
const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.addSearch = async (req, res) => {
  try {
    // Log chi tiết request
    console.log("=== Search History Request Debug ===");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("User from token:", req.user);
    console.log("Request URL:", req.originalUrl);
    console.log("Request method:", req.method);
    console.log("================================");

    const { query } = req.body;
    const userId = req.user.id; // Get user ID from JWT token
    const cleanedQuery = normalizeQuery(query);

    if (!userId || !cleanedQuery) {
      console.log("Missing data:", { userId, query: cleanedQuery });
      return res.status(400).json({ message: "Missing userId or query" });
    }

    // Find the user by their MongoDB ID
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Log trước khi tạo
    console.log("Creating search history with:", {
      user: user._id,
      query: cleanedQuery,
      timestamp: new Date(),
    });

    const search = await SearchHistory.findOneAndUpdate(
      {
        user: user._id,
        query: { $regex: new RegExp(`^${escapeRegex(cleanedQuery)}$`, "i") },
      },
      {
        user: user._id,
        query: cleanedQuery,
        timestamp: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Log sau khi tạo thành công
    console.log("Search history created successfully:", search);

    res.status(201).json({ data: search });
  } catch (error) {
    console.error("Error adding search:", error);
    // Log chi tiết lỗi
    if (error.name === "ValidationError") {
      console.error("Validation Error Details:", error.errors);
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from JWT token
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }

    // Find user by MongoDB ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get recent search history, sorted by timestamp
    const searchHistory = await SearchHistory.find({ user: user._id })
      .sort({ timestamp: -1 })
      .limit(30)
      .select("query timestamp");

    const uniqueHistory = [];
    const seenQueries = new Set();

    for (const item of searchHistory) {
      const normalized = normalizeQuery(item.query).toLowerCase();
      if (seenQueries.has(normalized)) continue;
      seenQueries.add(normalized);
      uniqueHistory.push(item);
      if (uniqueHistory.length >= 10) break;
    }

    res.status(200).json({ data: uniqueHistory });
  } catch (error) {
    console.error("Error getting search history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from JWT token
    const historyId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }

    // Find user by MongoDB ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete the search history item
    const result = await SearchHistory.findOneAndDelete({
      _id: historyId,
      user: user._id,
    });

    if (!result) {
      return res.status(404).json({ message: "Search history not found" });
    }

    res.status(200).json({ message: "Search history deleted successfully" });
  } catch (error) {
    console.error("Error deleting search history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
