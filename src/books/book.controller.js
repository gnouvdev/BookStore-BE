const Book = require("./book.model");
const Author = require("../authors/author.model"); // Import model Author
const mongoose = require("mongoose");
const Category = require("../categories/category.model"); // Import model Category
const { remove: removeDiacritics } = require("diacritics");
const Order = require("../orders/order.model"); // Import model Order
const User = require("../users/user.model"); // Import model User

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

    if (!id) {
      console.log("Error: No ID provided");
      return res.status(400).json({ message: "Book ID is required" });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Error: Invalid ObjectId format");
      return res.status(400).json({ message: "Invalid book ID format" });
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
    res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
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

    // Chuyển query về không dấu
    const normalizedQuery = normalizeText(query.toLowerCase());
    console.log("Normalized query:", normalizedQuery);

    let searchQuery = {};
    if (type === "title") {
      searchQuery = {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { title: { $regex: normalizedQuery, $options: "i" } },
        ],
      };
    } else if (type === "author") {
      const authors = await Author.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { name: { $regex: normalizedQuery, $options: "i" } },
        ],
      });
      searchQuery = { author: { $in: authors.map((a) => a._id) } };
    } else if (type === "category") {
      const categories = await Category.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { name: { $regex: normalizedQuery, $options: "i" } },
        ],
      });
      searchQuery = { category: { $in: categories.map((c) => c._id) } };
    } else if (type === "tag") {
      searchQuery = {
        $or: [
          { tags: { $regex: query, $options: "i" } },
          { tags: { $regex: normalizedQuery, $options: "i" } },
        ],
      };
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

      searchQuery = {
        $or: [
          // Tìm kiếm theo tiêu đề
          { title: { $regex: query, $options: "i" } },
          { title: { $regex: normalizedQuery, $options: "i" } },
          // Tìm kiếm theo tác giả
          { author: { $in: authors.map((a) => a._id) } },
          // Tìm kiếm theo danh mục
          { category: { $in: categories.map((c) => c._id) } },
          // Tìm kiếm theo tags
          { tags: { $regex: query, $options: "i" } },
          { tags: { $regex: normalizedQuery, $options: "i" } },
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

// Add this utility function at the top of the file
const normalizeText = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    console.log("Search suggestions request received:", { query });

    if (!query) {
      console.log("No query parameter provided");
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Normalize the query by removing diacritics
    const normalizedQuery = normalizeText(query.toLowerCase());
    console.log("Normalized query:", normalizedQuery);

    // Create a regex pattern that matches both with and without diacritics
    const regexPattern = new RegExp(`(${query}|${normalizedQuery})`, "i");

    // Search books with improved matching
    const books = await Book.find({
      $or: [
        { title: { $regex: regexPattern } },
        { title: { $regex: new RegExp(normalizedQuery, "i") } },
      ],
    })
      .populate("author", "name")
      .limit(5);

    // Search authors with improved matching
    const authors = await Author.find({
      $or: [
        { name: { $regex: regexPattern } },
        { name: { $regex: new RegExp(normalizedQuery, "i") } },
      ],
    }).limit(5);

    // Search categories with improved matching
    const categories = await Category.find({
      $or: [
        { name: { $regex: regexPattern } },
        { name: { $regex: new RegExp(normalizedQuery, "i") } },
      ],
    }).limit(5);

    // Search tags with improved matching
    const booksWithTags = await Book.find({
      $or: [
        { tags: { $regex: regexPattern } },
        { tags: { $regex: new RegExp(normalizedQuery, "i") } },
      ],
    }).select("tags");

    // Get unique tags with improved matching
    const tags = [...new Set(booksWithTags.flatMap((book) => book.tags))]
      .filter((tag) => {
        const normalizedTag = normalizeText(tag.toLowerCase());
        return (
          tag.toLowerCase().includes(query.toLowerCase()) ||
          normalizedTag.includes(normalizedQuery)
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

// Get books with statistics and sales data
const getBooksWithStats = async (req, res) => {
  try {
    console.log("Starting getBooksWithStats...");
    console.log("Request headers:", req.headers);
    console.log("Request query:", req.query);
    console.log("Request params:", req.params);

    // Validate models
    if (!Book || !Order || !User) {
      console.error("Models not initialized:", {
        Book: !!Book,
        Order: !!Order,
        User: !!User,
      });
      return res.status(500).json({
        success: false,
        message: "Database models not properly initialized",
      });
    }

    // Get books with basic info
    let books = [];
    try {
      console.log("Fetching books...");
      const bookQuery = Book.find()
        .select(
          "title author genre coverImage price quantity rating reviews description tags bestseller newArrival"
        )
        .populate({
          path: "author",
          select: "name",
          model: "Author",
        });

      console.log("Book query constructed:", bookQuery.toString());
      books = await bookQuery.lean().exec();
      console.log("Books fetched successfully:", books.length);
      console.log(
        "First book sample:",
        books[0]
          ? {
              id: books[0]._id,
              title: books[0].title,
              author: books[0].author,
            }
          : "No books found"
      );
    } catch (bookError) {
      console.error("Error fetching books:", bookError);
      console.error("Error stack:", bookError.stack);
      return res.status(500).json({
        success: false,
        message: "Error fetching books",
        error: bookError.message,
        stack:
          process.env.NODE_ENV === "development" ? bookError.stack : undefined,
      });
    }

    // Initialize statistics with default values
    const statistics = {
      totalBooks: 0,
      totalOrders: 0,
      totalCustomers: 0,
      totalSales: 0,
    };

    // Get total statistics with error handling
    try {
      console.log("Fetching statistics...");
      const [totalBooks, totalOrders, totalCustomers] = await Promise.all([
        Book.countDocuments().exec(),
        Order.countDocuments().exec(),
        User.countDocuments().exec(),
      ]);

      statistics.totalBooks = totalBooks || 0;
      statistics.totalOrders = totalOrders || 0;
      statistics.totalCustomers = totalCustomers || 0;

      console.log("Basic statistics fetched:", statistics);

      const salesResult = await Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]).exec();

      statistics.totalSales = salesResult[0]?.total || 0;
      console.log("Sales statistics fetched:", statistics.totalSales);
    } catch (statsError) {
      console.error("Error getting statistics:", statsError);
      console.error("Stats error stack:", statsError.stack);
      // Continue with default values instead of returning error
    }

    // Get genre statistics with error handling
    let genreStats = [];
    try {
      console.log("Fetching genre statistics...");
      const genrePipeline = [
        {
          $group: {
            _id: { $ifNull: ["$genre", "Uncategorized"] },
            count: { $sum: 1 },
            sales: { $sum: { $ifNull: ["$quantity", 0] } },
          },
        },
        { $sort: { count: -1 } },
      ];
      console.log("Genre pipeline:", JSON.stringify(genrePipeline, null, 2));

      genreStats = await Book.aggregate(genrePipeline).exec();
      console.log("Genre statistics fetched:", genreStats.length);
      console.log("Genre stats sample:", genreStats.slice(0, 2));
    } catch (genreError) {
      console.error("Error getting genre statistics:", genreError);
      console.error("Genre error stack:", genreError.stack);
      genreStats = [];
    }

    // Get bestseller books with error handling
    let bestsellers = [];
    try {
      console.log("Fetching bestsellers...");
      const bestsellerQuery = Book.find({ bestseller: true })
        .select("title author genre coverImage price quantity rating reviews")
        .populate({
          path: "author",
          select: "name",
          model: "Author",
        })
        .limit(6);

      console.log("Bestseller query constructed:", bestsellerQuery.toString());
      bestsellers = await bestsellerQuery.lean().exec();
      console.log("Bestsellers fetched:", bestsellers.length);
      console.log(
        "Bestseller sample:",
        bestsellers[0]
          ? {
              id: bestsellers[0]._id,
              title: bestsellers[0].title,
              author: bestsellers[0].author,
            }
          : "No bestsellers found"
      );
    } catch (bestsellerError) {
      console.error("Error getting bestsellers:", bestsellerError);
      console.error("Bestseller error stack:", bestsellerError.stack);
      bestsellers = [];
    }

    // Prepare response data
    const responseData = {
      success: true,
      data: {
        books: books || [],
        statistics: statistics || {},
        genreStats: genreStats || [],
        bestsellers: bestsellers || [],
      },
    };

    console.log("Sending response with data:", {
      booksCount: books.length,
      genreStatsCount: genreStats.length,
      bestsellersCount: bestsellers.length,
      statistics: statistics,
    });

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in getBooksWithStats:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch books with statistics",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Get book sales by genre
const getBookSalesByGenre = async (req, res) => {
  try {
    console.log("Starting getBookSalesByGenre...");

    // Validate models
    if (!Book || !Order) {
      console.error("Models not initialized:", {
        Book: !!Book,
        Order: !!Order,
      });
      return res.status(500).json({
        success: false,
        message: "Database models not properly initialized",
      });
    }

    // Get sales by genre with error handling
    let salesByGenre = [];
    try {
      console.log("Fetching sales by genre...");
      salesByGenre = await Order.aggregate([
        { $match: { status: "completed" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "books",
            localField: "items.book",
            foreignField: "_id",
            as: "bookDetails",
          },
        },
        { $unwind: "$bookDetails" },
        {
          $lookup: {
            from: "categories",
            localField: "bookDetails.category",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        { $unwind: "$categoryDetails" },
        {
          $group: {
            _id: "$categoryDetails.name",
            totalSales: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
        { $sort: { totalSales: -1 } },
      ]).exec();

      console.log("Sales by genre fetched:", salesByGenre.length);
      console.log("Sample sales data:", salesByGenre.slice(0, 2));
    } catch (error) {
      console.error("Error getting sales by genre:", error);
      console.error("Error stack:", error.stack);
      return res.status(500).json({
        success: false,
        message: "Error fetching sales by genre",
        error: error.message,
      });
    }

    // Prepare response data
    const responseData = {
      success: true,
      data: salesByGenre.map((stat) => ({
        _id: stat._id || "Uncategorized",
        totalSales: stat.totalSales || 0,
        revenue: stat.revenue || 0,
      })),
    };

    console.log("Sending response with data:", {
      statsCount: responseData.data.length,
    });

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in getBookSalesByGenre:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales by genre",
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
  getBooksWithStats,
  getBookSalesByGenre,
};
