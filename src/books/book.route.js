const express = require("express");
const Book = require("./book.model");
const {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
} = require("./book.controller");
const verifyAdminToken = require("../middleware/verifyAdminToken");
const router = express.Router();

//frontrend = > backed server = > controller => book Schema  => database => send to server => back to the frontend
// post = when submit something fronted to db
//get = when get something back from db
//put/patch = when edit or update something
//delete = when delete something

router.post("/create-book",verifyAdminToken, postABook);
//get all books
router.get("/", getAllBooks);

//get single book
router.get("/:id", getSingleBook);

//update a book endpoint
router.put("/edit/:id",verifyAdminToken, UpdateBook);

//delete book
router.delete("/:id",verifyAdminToken, deleteABook);
module.exports = router;
