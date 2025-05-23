const Book = require("./book.model");
const Author = require("../authors/author.model"); // Import model Author
const mongoose = require("mongoose");
const Category = require("../categories/category.model"); // Import model Category
const { remove: removeDiacritics } = require("diacritics");

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
    const books = await Book.aggregate([
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "book",
          as: "reviews",
        },
      },
      {
        $addFields: {
          rating: { $avg: "$reviews.rating" },
          numReviews: { $size: "$reviews" },
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ["$author", 0] },
          category: { $arrayElemAt: ["$category", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          coverImage: 1,
          price: 1,
          quantity: 1,
          trending: 1,
          language: 1,
          tags: 1,
          publish: 1,
          createdAt: 1,
          rating: { $ifNull: ["$rating", 0] },
          numReviews: { $ifNull: ["$numReviews", 0] },
          author: { _id: 1, name: 1 },
          category: { _id: 1, name: 1 },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
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

    const book = await Book.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "book",
          as: "reviews",
        },
      },
      {
        $addFields: {
          rating: { $avg: "$reviews.rating" },
          numReviews: { $size: "$reviews" },
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $addFields: {
          author: { $arrayElemAt: ["$author", 0] },
          category: { $arrayElemAt: ["$category", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          coverImage: 1,
          price: 1,
          quantity: 1,
          trending: 1,
          language: 1,
          tags: 1,
          publish: 1,
          createdAt: 1,
          rating: { $ifNull: ["$rating", 0] },
          numReviews: { $ifNull: ["$numReviews", 0] },
          author: { _id: 1, name: 1 },
          category: { _id: 1, name: 1 },
        },
      },
    ]);

    console.log("Book found:", book.length > 0 ? "Yes" : "No");
    if (!book || book.length === 0) {
      console.log("Error: Book not found");
      return res.status(404).json({ message: "Book not found" });
    }

    console.log("Successfully retrieved book:", book[0]._id);
    res.status(200).json(book[0]);
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
    const { query, type } = req.query;
    console.log("Search request received:", { query, type });

    if (!query) {
      console.log("No query parameter provided");
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Loại bỏ dấu từ query và chuẩn hóa khoảng trắng
    const normalizedQuery = removeDiacritics(query)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    console.log("Normalized query:", normalizedQuery);

    let searchQuery = {};
    if (type === "title") {
      searchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { title: { $regex: normalizedQuery, $options: "i" } },
      ];
    } else if (type === "author") {
      // Tìm kiếm theo tên tác giả
      const authors = await Author.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { name: { $regex: normalizedQuery, $options: "i" } },
        ],
      });
      const authorIds = authors.map((author) => author._id);
      searchQuery.author = { $in: authorIds };
    } else if (type === "category") {
      // Tìm kiếm theo tên danh mục
      const categories = await Category.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { name: { $regex: normalizedQuery, $options: "i" } },
        ],
      });
      const categoryIds = categories.map((category) => category._id);
      searchQuery.category = { $in: categoryIds };
    } else if (type === "tag") {
      searchQuery.$or = [
        { tags: { $regex: query, $options: "i" } },
        { tags: { $regex: normalizedQuery, $options: "i" } },
      ];
    } else {
      // Tìm kiếm tổng hợp
      const [authors, categories] = await Promise.all([
        Author.find({
          $or: [
            { name: { $regex: query, $options: "i" } },
            { name: { $regex: normalizedQuery, $options: "i" } },
          ],
        }),
        Category.find({
          $or: [
            { name: { $regex: query, $options: "i" } },
            { name: { $regex: normalizedQuery, $options: "i" } },
          ],
        }),
      ]);

      const authorIds = authors.map((author) => author._id);
      const categoryIds = categories.map((category) => category._id);

      // Tạo mảng các từ khóa để tìm kiếm
      const searchTerms = [
        query,
        normalizedQuery,
        ...query.split(/\s+/),
        ...normalizedQuery.split(/\s+/),
      ].filter((term) => term.length > 0);

      // Tạo mảng các RegExp objects
      const searchRegexes = searchTerms.map((term) => new RegExp(term, "i"));

      searchQuery = {
        $or: [
          // Tìm kiếm theo tiêu đề
          { title: { $in: searchRegexes } },
          // Tìm kiếm theo tác giả
          { author: { $in: authorIds } },
          // Tìm kiếm theo danh mục
          { category: { $in: categoryIds } },
          // Tìm kiếm theo tags
          { tags: { $in: searchRegexes } },
        ],
      };
    }

    console.log("Search query:", JSON.stringify(searchQuery, null, 2));

    const books = await Book.find(searchQuery)
      .populate("author", "name")
      .populate("category", "name")
      .limit(20);

    console.log(`Found ${books.length} books`);
    res.status(200).json(books);
  } catch (error) {
    console.error("Error searching books:", error);
    res.status(500).json({
      message: "Error searching books",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    console.log("Search suggestions request received:", { query });

    if (!query) {
      console.log("No query parameter provided");
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Loại bỏ dấu từ query
    const normalizedQuery = removeDiacritics(query);
    console.log("Normalized query:", normalizedQuery);

    // Tìm kiếm sách theo tiêu đề
    const books = await Book.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { title: { $regex: normalizedQuery, $options: "i" } },
      ],
    })
      .populate("author", "name")
      .limit(5);

    // Tìm kiếm tác giả
    const authors = await Author.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { name: { $regex: normalizedQuery, $options: "i" } },
      ],
    }).limit(5);

    // Tìm kiếm danh mục
    const categories = await Category.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { name: { $regex: normalizedQuery, $options: "i" } },
      ],
    }).limit(5);

    // Tìm kiếm tags
    const booksWithTags = await Book.find({
      $or: [
        { tags: { $regex: query, $options: "i" } },
        { tags: { $regex: normalizedQuery, $options: "i" } },
      ],
    }).select("tags");

    // Lấy danh sách tags duy nhất
    const tags = [...new Set(booksWithTags.flatMap((book) => book.tags))]
      .filter((tag) => {
        const normalizedTag = removeDiacritics(tag);
        return (
          tag.toLowerCase().includes(query.toLowerCase()) ||
          normalizedTag.toLowerCase().includes(normalizedQuery.toLowerCase())
        );
      })
      .slice(0, 5);

    console.log("Search suggestions results:", {
      booksCount: books.length,
      authorsCount: authors.length,
      categoriesCount: categories.length,
      tagsCount: tags.length,
    });

    res.status(200).json({
      books,
      authors,
      categories,
      tags,
    });
  } catch (error) {
    console.error("Error getting search suggestions:", error);
    res.status(500).json({
      message: "Error getting search suggestions",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

module.exports = {
  postABook,
  getAllBooks,
  getSingleBook,
  UpdateBook,
  deleteABook,
  searchBooks,
  getSearchSuggestions,
};
