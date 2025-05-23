const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Author",
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  }, // Tham chiếu đến Category
  coverImage: { type: String, required: true },
  price: {
    oldPrice: { type: Number, required: true }, // Giá cũ (float)
    newPrice: { type: Number, required: true }, // Giá mới (float)
  },
  quantity: { type: Number, required: true },
  trending: { type: Boolean, default: false },
  language: {
    type: String,
    enum: ["Tiếng Anh", "Tiếng Việt"], // Chỉ cho phép 2 giá trị
    required: true,
    default: "Tiếng Anh", // Giá trị mặc định
  },
  tags: [{ type: String }], // Mảng các chuỗi
  publish: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

// Create text index for searchable fields
bookSchema.index(
  {
    title: "text",
    description: "text",
    tags: "text",
  },
  {
    weights: {
      title: 10,
      tags: 5,
      description: 1,
    },
    name: "book_text_search",
    default_language: "none", // Disable language-specific stemming
    language_override: "none", // Disable language override
  }
);

// Create the model
const Book = mongoose.model("Book", bookSchema);

// Ensure indexes are created when the application starts
const createIndexes = async () => {
  try {
    // Drop existing text index if it exists
    await Book.collection.dropIndex("book_text_search").catch(() => {
      console.log("No existing text index to drop");
    });

    // Create new text index
    await Book.collection.createIndex(
      {
        title: "text",
        description: "text",
        tags: "text",
      },
      {
        weights: {
          title: 10,
          tags: 5,
          description: 1,
        },
        name: "book_text_search",
        default_language: "none",
        language_override: "none",
      }
    );
    console.log("Text index created successfully");
  } catch (error) {
    console.error("Error creating text index:", error);
    // Don't throw the error, just log it
  }
};

// Call createIndexes when the model is initialized
createIndexes();

module.exports = Book;
