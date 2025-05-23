const mongoose = require("mongoose");

const viewHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  timestamp: { type: Date, default: Date.now },
});

viewHistorySchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model("ViewHistory", viewHistorySchema);
