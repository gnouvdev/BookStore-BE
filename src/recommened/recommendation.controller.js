const mongoose = require("mongoose");
const Book = require("../books/book.model");
const natural = require("natural");
const cosineSimilarity = require("compute-cosine-similarity");

const getRecommendations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book ID" });
    }

    // Lấy sách với thông tin author và category đã được populate
    const books = await Book.find({})
      .populate('author', 'name')
      .populate('category', 'name')
      .lean();

    if (!books.length) {
      return res.status(404).json({ message: "No books found" });
    }

    // Kết hợp các trường với trọng số khác nhau
    const combinedFeatures = books.map((book) => {
      // Định nghĩa trọng số cho từng thuộc tính
      const weights = {
        title: 3,          // Tiêu đề sách
        description: 1,    // Mô tả
        category: 2,       // Thể loại
        author: 2,         // Tác giả
        tags: 1,           // Tags
        language: 1,       // Ngôn ngữ
        publish: 0.5,      // Nhà xuất bản
        trending: 0.5      // Sách trending
      };

      // Xử lý các trường có thể undefined
      const title = book.title || '';
      const description = book.description || '';
      const categoryName = book.category?.name || '';
      const authorName = book.author?.name || '';
      const tags = book.tags?.join(' ') || '';
      const language = book.language || '';
      const publish = book.publish || '';
      const trending = book.trending ? 'trending' : '';

      // Tạo chuỗi đặc trưng với trọng số
      const featureString = [
        title.repeat(weights.title),
        description.repeat(weights.description),
        categoryName.repeat(weights.category),
        authorName.repeat(weights.author),
        tags.repeat(weights.tags),
        language.repeat(weights.language),
        publish.repeat(weights.publish),
        trending.repeat(weights.trending)
      ].join(' ').toLowerCase();

      return {
        text: featureString,
        book
      };
    });

    // Tính TF-IDF
    const tfidf = new natural.TfIdf();
    combinedFeatures.forEach((feature) => tfidf.addDocument(feature.text));

    // Tạo ma trận TF-IDF với các tính năng bổ sung
    const tfidfMatrix = combinedFeatures.map((feature, index) => {
      const vector = {};
      tfidf.listTerms(index).forEach((term) => {
        vector[term.term] = term.tfidf;
      });
      return vector;
    });

    // Chuyển ma trận thành dạng số
    const allTerms = [...new Set(tfidfMatrix.flatMap((vec) => Object.keys(vec)))];
    const numericMatrix = tfidfMatrix.map((vector) => {
      return allTerms.map((term) => vector[term] || 0);
    });

    // Tìm sách gốc
    const bookIndex = books.findIndex((book) => book._id.toString() === id);
    if (bookIndex === -1) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Tính cosine similarity với ngưỡng tối thiểu
    const MIN_SIMILARITY_THRESHOLD = 0.1;
    const similarities = numericMatrix.map((vector, i) => {
      const similarity = cosineSimilarity(numericMatrix[bookIndex], vector);
      return {
        index: i,
        similarity,
        book: books[i]
      };
    });

    // Sắp xếp và lọc kết quả với các tiêu chí bổ sung
    const sortedSimilarities = similarities
      .filter(sim => {
        const isNotOriginal = sim.index !== bookIndex;
        const hasMinSimilarity = sim.similarity > MIN_SIMILARITY_THRESHOLD;
        const sameCategory = sim.book.category?.name === books[bookIndex].category?.name;
        const sameLanguage = sim.book.language === books[bookIndex].language;
        const isTrending = sim.book.trending;

        // Ưu tiên sách cùng thể loại và ngôn ngữ
        return isNotOriginal && hasMinSimilarity && (sameCategory || sameLanguage);
      })
      .sort((a, b) => {
        // Sắp xếp theo độ tương đồng và trending
        const similarityDiff = b.similarity - a.similarity;
        if (Math.abs(similarityDiff) < 0.1) {
          // Nếu độ tương đồng gần nhau, ưu tiên sách trending
          return (b.book.trending ? 1 : 0) - (a.book.trending ? 1 : 0);
        }
        return similarityDiff;
      })
      .slice(0, 8);

    // Lấy thông tin chi tiết của sách gợi ý
    const recommendedBooks = await Book.find({
      _id: { $in: sortedSimilarities.map(sim => sim.book._id) }
    })
    .populate('author', 'name')
    .populate('category', 'name')
    .lean();

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