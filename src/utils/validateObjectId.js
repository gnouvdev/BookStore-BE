const mongoose = require("mongoose");

/**
 * Kiểm tra xem một chuỗi có phải là MongoDB ObjectId hợp lệ không
 * @param {string} id - Chuỗi cần kiểm tra
 * @returns {boolean} - true nếu là ObjectId hợp lệ, false nếu không
 */
const validateObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

module.exports = { validateObjectId };
