const express = require("express");
const Book = require("./book.model");
const {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
  searchBooks,
  getSearchSuggestions,
  getBooksWithStats,
  getBookSalesByGenre,
} = require("./book.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");
const router = express.Router();

//frontrend = > backed server = > controller => book Schema  => database => send to server => back to the frontend
// post = when submit something fronted to db
//get = when get something back from db
//put/patch = when edit or update something
//delete = when delete something

router.post("/create-book", verifyAdminToken, postABook);

//get all books
router.get("/", getAllBooks);

//search books
router.get("/search", searchBooks);

//search suggestions
router.get("/search/suggestions", getSearchSuggestions);

//get books by author
router.get("/author/:authorId", async (req, res) => {
  try {
    const books = await Book.find({ author: req.params.authorId })
      .populate("author", "name")
      .populate("category", "name");
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//get books by category
router.get("/category/:categoryId", async (req, res) => {
  try {
    const books = await Book.find({ category: req.params.categoryId })
      .populate("author", "name")
      .populate("category", "name");
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//get single book
router.get("/:id", getSingleBook);

//update a book endpoint
router.put("/edit/:id", verifyAdminToken, UpdateBook);

//delete book
router.delete("/:id", verifyAdminToken, deleteABook);

//get books with stats
router.get("/stats", getBooksWithStats);

//get book sales by genre
router.get("/sales-by-genre", getBookSalesByGenre);

module.exports = router;
