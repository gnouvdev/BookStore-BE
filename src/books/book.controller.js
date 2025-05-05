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

    // Kiểm tra id có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book ID" });
    }

    const book = await Book.findById(id)
      .populate("author")
      .populate("category");
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.status(200).send(book);
  } catch (error) {
    console.error("Error fetching book:", error);
    res.status(500).send({ message: "Failed to fetch book", error });
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
    const { title, tags, author, language } = req.body;

    const query = {};

    if (title) {
      query.title = { $regex: title, $options: "i" }; // Tìm kiếm không phân biệt hoa thường
    }

    if (tags) {
      query.tags = { $in: tags }; // Tìm kiếm sách có ít nhất một tag khớp
    }

    if (author) {
      query.author = author; // Tìm kiếm theo tác giả
    }

    if (language) {
      query.language = language; // Tìm kiếm theo ngôn ngữ
    }

    console.log("Search query:", query); // Log truy vấn tìm kiếm

    const books = await Book.find(query);

    if (books.length === 0) {
      return res.status(404).json({ message: "No books found" });
    }

    res.status(200).json(books);
  } catch (error) {
    console.error("Error searching books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
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
