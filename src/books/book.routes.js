const express = require("express");
const router = express.Router();
const {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
  searchBooks,
  getSearchSuggestions,
} = require("./book.controller");
const { verifyToken } = require("../../middleware/verifyToken");

// Public routes
router.get("/", getAllBooks);
router.get("/search", searchBooks);
router.get("/search/suggestions", getSearchSuggestions);
router.get("/:id", getSingleBook);

// Protected routes
router.post("/", verifyToken, postABook);
router.put("/:id", verifyToken, UpdateBook);
router.delete("/:id", verifyToken, deleteABook);

module.exports = router;
