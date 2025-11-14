const mongoose = require("mongoose");
const Book = require("../books/book.model");
const natural = require("natural");
const cosineSimilarity = require("compute-cosine-similarity");
const { createFeatureText } = require("../utils/textPreprocessing");

const getRecommendations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book ID" });
    }
    const books = await Book.find({})
      .populate('author', 'name')
      .populate('category', 'name')
      .lean();

    if (!books.length) {
      return res.status(404).json({ message: "No books found" });
    }

    // Sử dụng text preprocessing để tạo features tốt hơn
    const combinedFeatures = books.map((book) => {
      return createFeatureText(
        book.title,
        book.description,
        book.tags,
        book.category?.name,
        book.author?.name
      );
    });

    const tfidf = new natural.TfIdf();
    combinedFeatures.forEach((text) => tfidf.addDocument(text));

    const tfidfMatrix = combinedFeatures.map((feature, index) => {
      const vector = {};
      tfidf.listTerms(index).forEach((term) => {
        vector[term.term] = term.tfidf;
      });
      return vector;
    });

    const allTerms = [...new Set(tfidfMatrix.flatMap((vec) => Object.keys(vec)))];
    const numericMatrix = tfidfMatrix.map((vector) => {
      return allTerms.map((term) => vector[term] || 0);
    });

    const bookIndex = books.findIndex((book) => book._id.toString() === id);
    if (bookIndex === -1) {
      return res.status(404).json({ message: "Book not found" });
    }

    const MIN_SIMILARITY_THRESHOLD = 0.1;
    const similarities = numericMatrix.map((vector, i) => {
      const similarity = cosineSimilarity(numericMatrix[bookIndex], vector);
      return {
        index: i,
        similarity,
        book: books[i]
      };
    });

    // Cải thiện filtering và sorting
    const sortedSimilarities = similarities
      .filter(sim => {
        const isNotOriginal = sim.index !== bookIndex;
        const hasMinSimilarity = sim.similarity > MIN_SIMILARITY_THRESHOLD;
        
        // Không bắt buộc cùng category/language, nhưng ưu tiên
        const sameCategory = sim.book.category?.name === books[bookIndex].category?.name;
        const sameLanguage = sim.book.language === books[bookIndex].language;
        const sameAuthor = sim.book.author?.name === books[bookIndex].author?.name;
        
        return isNotOriginal && hasMinSimilarity;
      })
      .sort((a, b) => {
        // Tính điểm ưu tiên
        const getPriority = (sim) => {
          let priority = sim.similarity;
          
          // Ưu tiên cùng category (+0.1)
          if (sim.book.category?.name === books[bookIndex].category?.name) {
            priority += 0.1;
          }
          
          // Ưu tiên cùng author (+0.15)
          if (sim.book.author?.name === books[bookIndex].author?.name) {
            priority += 0.15;
          }
          
          // Ưu tiên cùng language (+0.05)
          if (sim.book.language === books[bookIndex].language) {
            priority += 0.05;
          }
          
          // Ưu tiên trending (+0.1)
          if (sim.book.trending) {
            priority += 0.1;
          }
          
          return priority;
        };
        
        return getPriority(b) - getPriority(a);
      })
      .slice(0, 8);

    const recommendedBookIds = sortedSimilarities.map(sim => sim.book._id);
    const recommendedBooks = await Book.aggregate([
      { $match: { _id: { $in: recommendedBookIds } } },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "book",
          as: "reviews"
        }
      },
      {
        $addFields: {
          rating: { $ifNull: [{ $avg: "$reviews.rating" }, 0] },
          totalRatings: { $size: "$reviews" }
        }
      },
      {
        $lookup: {
          from: "authors",
          localField: "author",
          foreignField: "_id",
          as: "author"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $addFields: {
          author: { $arrayElemAt: ["$author", 0] },
          category: { $arrayElemAt: ["$category", 0] }
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          coverImage: 1,
          price: 1,
          rating: 1,
          totalRatings: 1,
          author: { _id: 1, name: 1 },
          category: { _id: 1, name: 1 },
          trending: 1,
          language: 1,
          tags: 1,
          publish: 1,
        }
      }
    ]);

    res.status(200).json({
      message: "Recommendations fetched successfully",
      recommendations: recommendedBooks,
      similarities: sortedSimilarities.map(sim => ({
        bookId: sim.book._id,
        similarity: sim.similarity,
        isTrending: sim.book.trending,
        category: sim.book.category?.name,
        language: sim.book.language
      }))
    });
  } catch (error) {
    console.error("Error in getRecommendations:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getRecommendations };