const express = require("express");
const {
  addAuthor,
  getAllAuthors,
  getSingleAuthor,
  updateAuthor,
  deleteAuthor,
  searchAuthors,
} = require("./author.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");
const router = express.Router();

// Tạo tác giả mới
router.post("/create", addAuthor);

// Lấy tất cả tác giả
router.get("/", getAllAuthors);

// Lấy 1 tác giả
router.get("/:id", getSingleAuthor);

// Cập nhật tác giả
router.put("/edit/:id", updateAuthor);

// Xóa tác giả
router.delete("/:id", deleteAuthor);

// Tìm kiếm tác giả theo tên
// Tìm kiếm tác giả theo tên
router.get("/search", searchAuthors);

module.exports = router;
