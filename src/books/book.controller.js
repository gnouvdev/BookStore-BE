const Book = require("./book.model");
const Author = require("../authors/author.model"); // Import model Author
const mongoose = require("mongoose");

const postABook = async (req, res) => {
  try {
    const { author, language, tags } = req.body;

    console.log("Request body:", req.body); // Log dữ liệu nhận được

    // Kiểm tra xem author tồn tại không
    const existingAuthor = await Author.findById(author);
    if (!existingAuthor) {
      return res.status(400).send({ message: "Author not found" });
    }

    // Kiểm tra giá trị của language
    if (!["Tiếng Anh", "Tiếng Việt"].includes(language)) {
      return res.status(400).send({ message: "Invalid language value" });
    }

    // Đảm bảo tags là một mảng
    const processedTags = tags && Array.isArray(tags) ? tags : [];

    const newBook = new Book({ ...req.body, tags: processedTags });
    await newBook.save();

    res
      .status(200)
      .send({ message: "Book created successfully", book: newBook });
  } catch (error) {
    console.error("Error creating book", error);
    res.status(500).send({ message: "Failed to create book", error });
  }
};

//get all books
const getAllBooks = async (req, res) => {
  try {
    const books = await Book.find()
      .populate("author", "name") // Lấy tên tác giả
      .populate("category", "name") // Lấy tên danh mục
      .sort({ createdAt: -1 });
    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
  }
};
//get a single book
const getSingleBook = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Book ID received:", id);
    console.log("Request params:", req.params);
    console.log("Request query:", req.query);

    if (!id) {
      console.log("Error: No ID provided");
      return res.status(400).json({ message: "Book ID is required" });
    }

    const book = await Book.findById(id)
      .populate("author", "name")
      .populate("category", "name");

    console.log("Book found:", book ? "Yes" : "No");
    if (!book) {
      console.log("Error: Book not found");
      return res.status(404).json({ message: "Book not found" });
    }

    console.log("Successfully retrieved book:", book._id);
    res.status(200).json(book);
  } catch (error) {
    console.error("Error in getSingleBook:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// update book
const UpdateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { author, language, tags } = req.body;

    console.log("Request body:", req.body); // Log dữ liệu nhận được

    // Kiểm tra xem author tồn tại không
    if (author) {
      const authorExists = await Author.findById(author);
      if (!authorExists) {
        return res.status(400).send({ message: "Author not found" });
      }
    }

    // Kiểm tra giá trị của language
    if (language && !["Tiếng Anh", "Tiếng Việt"].includes(language)) {
      return res.status(400).send({ message: "Invalid language value" });
    }

    // Đảm bảo tags là một mảng
    const processedTags = tags && Array.isArray(tags) ? tags : [];

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      { ...req.body, tags: processedTags },
      { new: true }
    );

    if (!updatedBook) {
      return res.status(404).send({ message: "Book not found" });
    }

    res
      .status(200)
      .send({ message: "Book updated successfully", book: updatedBook });
  } catch (error) {
    console.error("Error updating book", error);
    res.status(500).send({ message: "Failed to update book" });
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
    const { query } = req.query;

    if (!query) {
      return res.status(400).send({ message: "Search query is required" });
    }

    // Tìm kiếm sách theo BookTextIndex
    const bookSearch = Book.aggregate([
      {
        $search: {
          index: "BookTextIndex",
          text: {
            query: query,
            path: { wildcard: "*" }
          }
        }
      }
    ]);

    // Tìm kiếm tác giả theo tên
    const authorSearch = Author.find({
      name: { $regex: query, $options: "i" }
    }).select("_id");

    // Chạy cả hai truy vấn song song
    const [booksFromSearch, authors] = await Promise.all([bookSearch, authorSearch]);

    // Lấy ID tác giả từ kết quả tìm kiếm
    const authorIds = authors.map((author) => author._id);

    // Tìm sách của các tác giả khớp
    const booksFromAuthors = await Book.find({
      author: { $in: authorIds }
    });

    // Kết hợp và loại bỏ trùng lặp
    const allBooks = [...booksFromSearch, ...booksFromAuthors];
    const uniqueBooks = Array.from(
      new Map(allBooks.map((book) => [book._id.toString(), book])).values()
    );

    // Populate author và category
    const populatedBooks = await Book.populate(uniqueBooks, [
      { path: "author", select: "name" },
      { path: "category", select: "name" }
    ]);

    // Sắp xếp theo createdAt
    const sortedBooks = populatedBooks.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (sortedBooks.length === 0) {
      return res.status(404).send({ message: "No books found" });
    }

    res.status(200).send(sortedBooks);
  } catch (error) {
    console.error("Error searching books:", error);
    res.status(500).send({ message: "Failed to search books", error: error.message });
  }
};

module.exports = {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
  searchBooks,
};
