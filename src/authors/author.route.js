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
router.post("/create", verifyAdminToken, addAuthor);

// Tìm kiếm tác giả theo tên
router.get("/search", searchAuthors);

// Lấy tất cả tác giả
router.get("/", getAllAuthors);

// Lấy 1 tác giả
router.get("/:id", getSingleAuthor);

// Cập nhật tác giả
router.put("/edit/:id", verifyAdminToken, updateAuthor);

// Xóa tác giả
router.delete("/:id", verifyAdminToken, deleteAuthor);

module.exports = router;
