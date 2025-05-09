const Book = require("./book.model");

const postABook = async (req, res) => {
  try {
    const newBook = await Book({ ...req.body });
    await newBook.save();
    res
      .status(200)
      .send({ message: "Book posted successfully", book: newBook });
  } catch (error) {
    console.error("Error creating book", error);
    res.status(500).send({ message: "Failed to create book", error });
  }
};

//get all books
const getAllBooks = async (req, res) => {
  try {
    const books = await Book.find().sort({ createAt: -1 });
    res.status(200).send(books);
  } catch (error) {
    console.log("Error fetching books", error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
};
//get a single book
const getSingleBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) {
      res.status(404).send({ message: "Book is not found" });
    }
    res.status(200).send(book);
  } catch (error) {
    console.log("Error fetching books", error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
};
// update book
const UpdateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBook = await Book.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedBook) {
      res.status(404).send({ message: "Book not found" });
    }
    res.status(200).send({
      message: "Book updated successfullly ",
      book: updatedBook,
    });
  } catch (error) {
    console.log("Error updating a books", error);
    res.status(500).send({ message: "Failed to update a books" });
  }
};
const deleteABook = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBook = await Book.findByIdAndDelete(id);
    if (!deletedBook) {
      res.status(404).send({ message: "Book is not found" });
    }
    res.status(200).send({
      message: "Book deleted successfullly ",
      book: deletedBook,
    });
  } catch (error) {
    console.log("Error delete a books", error);
    res.status(500).send({ message: "Failed to delete a books" });
  }
};
const searchBooks = async (req, res) => {
  try {
      const { title } = req.body; // Lấy từ khóa từ JSON body

      if (!title) {
          return res.status(400).json({ message: "Title is required" });
      }

      // Tìm kiếm sách theo title (không phân biệt hoa thường)
      const books = await Book.find({
          title: { $regex: title, $options: "i" }
      });

      if (books.length === 0) {
          return res.status(404).json({ message: "No books found" });
      }

      res.status(200).json(books);
  } catch (error) {
      console.error("Error searching books:", error);
      res.status(500).json({ message: "Failed to fetch books" });
  }
};

module.exports = { searchBooks };

module.exports = {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
  searchBooks,
};
