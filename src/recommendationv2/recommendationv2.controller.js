const Order = require("../orders/order.model");
const Review = require("../reviews/review.model");
const Cart = require("../cart/cart.model");
const ViewHistory = require("../viewHistory/viewHistory.model");
const SearchHistory = require("../searchHistory/searchHistory.model");
const Book = require("../books/book.model");
const User = require("../users/user.model");
const mongoose = require("mongoose");
const { getHolidayContext } = require("../utils/holidayContext");
const { getContextualModelRecommendations } = require("./contextualModel");

exports.getCollaborativeRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    if (!userId) {
      console.error("No user ID found in req.user:", req.user);
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }
    console.log(
      `Generating recommendations for user: ${userId}, email: ${userEmail}`
    );

    // Lấy hành vi người dùng hiện tại
    const user = await User.findById(userId)
      .select("wishlist")
      .populate("wishlist");
    const orders = await Order.find({
      $or: [{ user: userId }, { email: userEmail }],
    })
      .populate({ path: "productIds.productId", strictPopulate: false })
      .populate("user");
    console.log(
      `Found ${orders.length} orders for user ${userId} or email ${userEmail}`
    );
    if (orders.length > 0) {
      console.log("Sample order:", {
        id: orders[0]._id,
        user: orders[0].user?._id,
        email: orders[0].email,
        productIds: orders[0].productIds.map((item) => item.productId?._id),
      });
    }
    const reviews = await Review.find({
      user: userId,
      rating: { $gte: 3 },
    }).select("book rating");
    const carts = await Cart.find({
      $or: [{ user: userId }, { firebaseId: userId }],
    }).populate("items.book");
    // Lấy TẤT CẢ views để filter chính xác (không limit)
    const views = await ViewHistory.find({ user: userId })
      .select("book")
      .sort({ timestamp: -1 });
    const searches = await SearchHistory.find({ user: userId })
      .select("query")
      .sort({ timestamp: -1 })
      .limit(50);

    // Log schema để debug
    if (orders.length > 0) {
      console.log("Sample order productIds structure:", orders[0].productIds);
    }
    if (carts.length > 0) {
      console.log("Sample cart structure:", { items: carts[0].items });
    }

    // Tạo tập userBookIds với trọng số cải thiện và time decay
    const userBookIds = {};
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Time decay theo hàm mũ với half-life T_{1/2} = 7 ngày (kết quả từ thực nghiệm offline)
    const HALF_LIFE_DAYS = 7;
    const LAMBDA = Math.log(2) / HALF_LIFE_DAYS;
    const getTimeDecay = (timestamp) => {
      if (!timestamp) return 1.0;
      const daysAgo = (now - new Date(timestamp).getTime()) / DAY_MS;
      if (daysAgo <= 0) return 1.0;
      return Math.exp(-LAMBDA * daysAgo);
    };

    // Weighting cải thiện
    orders.forEach((order) => {
      if (!order.user || !order.user.id) {
        console.warn("Skipping order with missing user:", {
          id: order._id,
          user: order.user,
        });
        return;
      }
      if (!order.productIds || !Array.isArray(order.productIds)) {
        console.warn("Skipping order with missing or invalid productIds:", {
          id: order._id,
          productIds: order.productIds,
        });
        return;
      }
      const timeDecay = getTimeDecay(order.createdAt);
      order.productIds.forEach((item) => {
        if (item.productId && item.productId._id) {
          const bookId = item.productId._id.toString();
          // Mua hàng: weight cao nhất, có time decay
          const weight = 1.0 * timeDecay;
          userBookIds[bookId] = Math.max(userBookIds[bookId] || 0, weight);
        } else {
          console.warn("Skipping order item with missing productId:", item);
        }
      });
    });

    reviews.forEach((review) => {
      if (review.book) {
        const bookId = review.book.toString();
        const timeDecay = getTimeDecay(review.createdAt);
        // Review rating cao có weight cao hơn
        const ratingWeight =
          review.rating >= 4 ? 0.9 : review.rating >= 3 ? 0.7 : 0.5;
        const weight = ratingWeight * timeDecay;
        userBookIds[bookId] = Math.max(userBookIds[bookId] || 0, weight);
      }
    });

    carts.forEach((cart) => {
      if (cart.items && Array.isArray(cart.items)) {
        const timeDecay = getTimeDecay(cart.updatedAt);
        cart.items.forEach((item) => {
          if (item.book && item.book._id) {
            const bookId = item.book._id.toString();
            //Giỏ hàng
            const weight = 0.8 * timeDecay;
            userBookIds[bookId] = Math.max(userBookIds[bookId] || 0, weight);
          }
        });
      }
    });

    views.forEach((view) => {
      if (view.book) {
        const bookId = view.book.toString();
        const timeDecay = getTimeDecay(view.timestamp);
        // View gần đây quan trọng hơn
        const weight = 0.5 * timeDecay;
        userBookIds[bookId] = Math.max(userBookIds[bookId] || 0, weight);
      }
    });

    if (user && user.wishlist && Array.isArray(user.wishlist)) {
      user.wishlist.forEach((book) => {
        if (book && book._id) {
          const bookId = book._id.toString();
          // Wishlist: weight cao, không có time decay (vì không có timestamp)
          userBookIds[bookId] = Math.max(userBookIds[bookId] || 0, 0.7);
        }
      });
    }

    // Tìm sách từ lịch sử tìm kiếm
    const searchBooks = [];
    for (const search of searches) {
      try {
        const books = await Book.find(
          { $text: { $search: search.query } },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(5);
        books.forEach((book) => {
          if (
            !searchBooks.some((b) => b._id.toString() === book._id.toString())
          ) {
            searchBooks.push(book);
          }
        });
      } catch (error) {
        console.error("Error searching books for query:", search.query, error);
        // If text search fails, try a simple regex search as fallback
        try {
          const books = await Book.find({
            $or: [
              { title: { $regex: search.query, $options: "i" } },
              { tags: { $regex: search.query, $options: "i" } },
            ],
          }).limit(5);
          books.forEach((book) => {
            if (
              !searchBooks.some((b) => b._id.toString() === book._id.toString())
            ) {
              searchBooks.push(book);
            }
          });
        } catch (fallbackError) {
          console.error("Fallback search also failed:", fallbackError);
        }
      }
    }
    searchBooks.forEach((book) => {
      userBookIds[book._id.toString()] = 0.3; // Tìm kiếm
    });

    console.log("User interactions:", {
      orders: orders.length,
      reviews: reviews.length,
      carts: carts.length,
      views: views.length,
      searches: searches.length,
      wishlist: user?.wishlist?.length || 0,
      uniqueBooks: Object.keys(userBookIds).length,
    });

    // Nếu user CHƯA CÓ hành vi → Trả về sách phổ biến
    if (Object.keys(userBookIds).length < 1) {
      console.log("User has no interactions, returning popular books");
      const popularBooks = await Book.find()
        .sort({ numReviews: -1, rating: -1 })
        .limit(10)
        .populate("author", "name")
        .populate("category", "name");
      return res.status(200).json({ data: popularBooks });
    }

    // Nếu hành vi QUÁ ÍT (< 3 interactions) → Dùng Content-Based ngay (bỏ qua CF)
    // Vì không đủ dữ liệu để tìm users tương đồng hiệu quả
    const userInteractionCount = Object.keys(userBookIds).length;
    const USE_CONTENT_BASED_ONLY = userInteractionCount < 3;

    if (USE_CONTENT_BASED_ONLY) {
      console.log(
        `User has too few interactions (${userInteractionCount}), using Content-Based recommendations only`
      );
    }

    // Lấy top 1000 người dùng khác có tương tác gần nhất
    const allOrders = await Order.find({ user: { $ne: userId } })
      .populate({ path: "productIds.productId", strictPopulate: false })
      .populate("user")
      .sort({ createdAt: -1 })
      .limit(1000);
    const allReviews = await Review.find({
      user: { $ne: userId },
      rating: { $gte: 3 },
    })
      .select("book rating")
      .sort({ createdAt: -1 })
      .limit(1000);
    const allCarts = await Cart.find({ userId: { $ne: userId } })
      .populate("items.book")
      .sort({ updatedAt: -1 })
      .limit(1000);
    const allViews = await ViewHistory.find({ user: { $ne: userId } })
      .select("book")
      .sort({ timestamp: -1 })
      .limit(1000);
    const allSearches = await SearchHistory.find({ user: { $ne: userId } })
      .select("query")
      .sort({ timestamp: -1 })
      .limit(500);

    // Log số lượng allOrders để debug
    console.log("Number of allOrders:", allOrders.length);
    if (allOrders.length > 0) {
      console.log(
        "Sample allOrders products:",
        allOrders[0].productIds.map(
          (item) => item.productId?.title || "Unknown Product"
        )
      );
    } else {
      console.log(
        "No orders found for other users, falling back to popular books"
      );
      const popularBooks = await Book.find()
        .sort({ numReviews: -1, rating: -1 })
        .limit(10)
        .populate("author", "name")
        .populate("category", "name");
      return res.status(200).json({ data: popularBooks });
    }

    // Tính độ tương đồng
    const similarities = {};
    const otherUsersBooks = {};

    const processUserBooks = (userId, bookId, weight) => {
      const uid = userId.toString();
      if (!otherUsersBooks[uid]) otherUsersBooks[uid] = {};
      otherUsersBooks[uid][bookId] = weight;
    };

    allOrders.forEach((order) => {
      if (!order.user || !order.user.id) {
        console.warn("Skipping order with missing user:", {
          id: order._id,
          user: order.user,
        });
        return;
      }
      if (!order.productIds || !Array.isArray(order.productIds)) {
        console.warn("Skipping order with missing or invalid productIds:", {
          id: order._id,
          productIds: order.productIds,
        });
        return;
      }
      order.productIds.forEach((item) => {
        if (item.productId && item.productId._id) {
          processUserBooks(order.user.id, item.productId._id.toString(), 1.0);
        } else {
          console.warn("Skipping order item with missing productId:", item);
        }
      });
    });
    allReviews.forEach((review) => {
      if (review.user && review.book) {
        processUserBooks(
          review.user,
          review.book.toString(),
          review.rating / 4
        );
      }
    });
    allCarts.forEach((cart) => {
      if (cart.userId && cart.items && Array.isArray(cart.items)) {
        cart.items.forEach((item) => {
          if (item.book && item.book._id) {
            processUserBooks(cart.userId, item.book._id.toString(), 0.8);
          }
        });
      }
    });
    allViews.forEach((view) => {
      if (view.user && view.book) {
        processUserBooks(view.user, view.book.toString(), 0.5);
      }
    });

    // Cải thiện similarity calculation với Jaccard similarity và cosine similarity kết hợp
    for (const userId in otherUsersBooks) {
      const otherBookIds = otherUsersBooks[userId];

      // Cosine similarity (giữ nguyên)
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (const bookId in userBookIds) {
        if (otherBookIds[bookId]) {
          dotProduct += userBookIds[bookId] * otherBookIds[bookId];
        }
        normA += userBookIds[bookId] ** 2;
      }
      for (const bookId in otherBookIds) {
        normB += otherBookIds[bookId] ** 2;
      }

      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);
      const cosineSim = normA && normB ? dotProduct / (normA * normB) : 0;

      // Jaccard similarity: intersection / union
      const userBookSet = new Set(Object.keys(userBookIds));
      const otherBookSet = new Set(Object.keys(otherBookIds));
      const intersection = new Set(
        [...userBookSet].filter((x) => otherBookSet.has(x))
      );
      const union = new Set([...userBookSet, ...otherBookSet]);
      const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;

      // Mô hình lai: alpha * cosine + (1 - alpha) * jaccard
      // Dữ liệu thật gợi ý Jaccard nên chiếm tỷ trọng cao hơn,
      // do đó chọn alpha < 0.5 (ví dụ alpha = 0.3 <=> 30% cosine, 70% jaccard)
      const ALPHA_COSINE = 0.3;
      const hybridSim =
        ALPHA_COSINE * cosineSim + (1 - ALPHA_COSINE) * jaccardSim;
      similarities[userId] = hybridSim;
    }

    // Lọc similarities với threshold tối thiểu (chỉ giữ các user thực sự giống)
    // Để tránh noise làm chen lẫn thứ tự gợi ý, tăng ngưỡng trở lại
    const MIN_SIMILARITY_THRESHOLD = 0.15;
    const validSimilarities = Object.entries(similarities)
      .filter(([_, sim]) => sim >= MIN_SIMILARITY_THRESHOLD)
      .sort((a, b) => b[1] - a[1]);

    // Nếu không có đủ users similar, giảm threshold một chút nhưng vẫn giữ khá chặt
    if (validSimilarities.length === 0) {
      console.warn(
        `No similar users found with threshold ${MIN_SIMILARITY_THRESHOLD}, lowering threshold to 0.1`
      );
      const lowerThreshold = Object.entries(similarities)
        .filter(([_, sim]) => sim >= 0.1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      validSimilarities.push(...lowerThreshold);
    }

    console.log(
      "Top similarities:",
      validSimilarities
        .slice(0, 10)
        .map(([uid, sim]) => ({ userId: uid, similarity: sim.toFixed(3) }))
    );

    // Phân tích preferences của user hiện tại từ behavior
    const userPreferences = {
      categories: new Set(),
      authors: new Set(),
      tags: new Set(),
    };

    // Lấy preferences từ books user đã tương tác
    const userBookIdsArray = Object.keys(userBookIds);
    if (userBookIdsArray.length > 0) {
      const userBooks = await Book.find({
        _id: {
          $in: userBookIdsArray.map((id) => new mongoose.Types.ObjectId(id)),
        },
      })
        .populate("author", "name")
        .populate("category", "name")
        .select("category author tags")
        .lean();

      userBooks.forEach((book) => {
        if (book.category?.name)
          userPreferences.categories.add(book.category.name);
        if (book.author?.name) userPreferences.authors.add(book.author.name);
        if (Array.isArray(book.tags)) {
          book.tags.forEach((tag) => userPreferences.tags.add(tag));
        }
      });
    }

    console.log("User preferences:", {
      categories: Array.from(userPreferences.categories),
      authors: Array.from(userPreferences.authors),
      tagsCount: userPreferences.tags.size,
    });

    // Nếu hành vi quá ít (< 3) hoặc không tìm được users tương đồng → Bỏ qua CF, dùng Content-Based
    let finalCandidates = [];
    const userInteractedBookIds = new Set(Object.keys(userBookIds));
    // Khai báo bookScores ở ngoài để dùng sau này
    const bookScores = {}; // { bookId: { score, fromUsers: [] } }

    if (!USE_CONTENT_BASED_ONLY && validSimilarities.length > 0) {
      // CÓ ĐỦ HÀNH VI VÀ TÌM ĐƯỢC USERS TƯƠNG ĐỒNG → Dùng Collaborative Filtering
      console.log(
        `Using Collaborative Filtering (${validSimilarities.length} similar users found)`
      );

      // Lấy top similar users (tăng lên 10-15 để có diversity hơn)
      const topSimilarUsers = validSimilarities
        .slice(0, Math.max(10, validSimilarities.length))
        .map(([userId, similarity]) => ({ userId, similarity }));

      // Thu thập sách gợi ý với weighted scoring

      topSimilarUsers.forEach(({ userId, similarity }) => {
        const books = otherUsersBooks[userId];
        if (!books) return;

        for (const bookId in books) {
          if (!userBookIds[bookId]) {
            if (!bookScores[bookId]) {
              bookScores[bookId] = { score: 0, fromUsers: [] };
            }
            // Weighted score: similarity * interaction weight
            const interactionWeight = books[bookId];
            bookScores[bookId].score += similarity * interactionWeight;
            bookScores[bookId].fromUsers.push({
              userId,
              similarity,
              weight: interactionWeight,
            });
          }
        }
      });

      // Sắp xếp books theo score (từ cao xuống thấp)
      const cfRanked = Object.entries(bookScores)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([bookId, data]) => ({
          bookId,
          cfScore: data.score,
        }));

      // Loại trùng lặp
      const seen = new Set();
      const dedupedCF = cfRanked.filter((item) => {
        if (seen.has(item.bookId)) return false;
        seen.add(item.bookId);
        return true;
      });

      console.log(
        `Found ${dedupedCF.length} books from collaborative filtering`
      );

      // FILTER TRƯỚC: Loại bỏ sách user đã tương tác từ dedupedCF
      const filteredCF = dedupedCF.filter((item) => {
        return !userInteractedBookIds.has(item.bookId);
      });

      finalCandidates = [...filteredCF];
    } else {
      // HÀNH VI QUÁ ÍT HOẶC KHÔNG TÌM ĐƯỢC USERS TƯƠNG ĐỒNG → Bỏ qua CF
      if (USE_CONTENT_BASED_ONLY) {
        console.log(
          "Skipping Collaborative Filtering (too few interactions, using Content-Based only)"
        );
      } else {
        console.log(
          "Skipping Collaborative Filtering (no similar users found, using Content-Based only)"
        );
      }
      finalCandidates = [];
    }

    // Nếu không đủ (CF không đủ hoặc bỏ qua CF), thêm content-based recommendations
    // Content-Based: Gợi ý sách TƯƠNG ĐỒNG với sách user đã tương tác (category/author/tags)
    if (finalCandidates.length < 10) {
      console.log(
        "Adding content-based recommendations based on user preferences"
      );
      const existingBookIds = new Set([
        ...finalCandidates.map((item) => item.bookId),
        ...userBookIdsArray,
      ]);

      const contentBasedBooks = await Book.find({
        _id: {
          // existingBookIds là Set, cần chuyển sang mảng trước khi map
          $nin: Array.from(existingBookIds).map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
        $or: [
          ...(userPreferences.categories.size > 0
            ? [
                {
                  "category.name": {
                    $in: Array.from(userPreferences.categories),
                  },
                },
              ]
            : []),
          ...(userPreferences.authors.size > 0
            ? [{ "author.name": { $in: Array.from(userPreferences.authors) } }]
            : []),
          ...(userPreferences.tags.size > 0
            ? [{ tags: { $in: Array.from(userPreferences.tags) } }]
            : []),
        ],
      })
        .select("_id")
        .limit(20)
        .lean();

      // Thêm content-based books vào cuối (vì có cfScore = 0, sẽ đứng sau)
      contentBasedBooks.forEach((b) => {
        const id = b._id.toString();
        if (!existingBookIds.has(id)) {
          finalCandidates.push({
            bookId: id,
            cfScore: 0,
          });
          existingBookIds.add(id);
        }
      });

      console.log(
        `Added ${contentBasedBooks.length} content-based recommendations`
      );
    }

    // Tạo map từ finalCandidates để giữ thứ tự và cfScore
    const candidateMap = new Map(
      finalCandidates.map((item) => [item.bookId, item.cfScore])
    );

    let books = await Book.aggregate([
      {
        $match: {
          _id: {
            $in: finalCandidates.map(
              (item) => new mongoose.Types.ObjectId(item.bookId)
            ),
          },
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
          rating: { $ifNull: ["$rating", 0] },
          numReviews: { $ifNull: ["$numReviews", 0] },
          author: { _id: 1, name: 1 },
          category: { _id: 1, name: 1 },
          tags: 1,
          trending: 1,
        },
      },
    ]);

    // Tính điểm ưu tiên cho mỗi book dựa trên user preferences và collaborative score
    // Chỉ tạo bookScoresMap nếu có bookScores (từ CF)
    const bookScoresMap = new Map(
      Object.keys(bookScores).length > 0
        ? Object.entries(bookScores).map(([id, data]) => [id, data.score])
        : []
    );

    // Map books với cfScore từ candidateMap và tính các scores
    books.forEach((book) => {
      const bookId = book._id.toString();
      // Lấy cfScore từ candidateMap (đã được sắp xếp từ cao xuống thấp)
      book._cfScore = candidateMap.get(bookId) || 0;

      let personalizationScore = 0;

      // Boost nếu match với user preferences
      if (userPreferences.categories.has(book.category?.name)) {
        personalizationScore += 0.3; // Match category
      }
      if (userPreferences.authors.has(book.author?.name)) {
        personalizationScore += 0.4; // Match author (quan trọng hơn)
      }
      if (Array.isArray(book.tags)) {
        const matchingTags = book.tags.filter((tag) =>
          userPreferences.tags.has(tag)
        ).length;
        personalizationScore += matchingTags * 0.1; // Mỗi tag match +0.1
      }

      // Collaborative score từ similar users
      const collaborativeScore = bookScoresMap.get(bookId) || 0;

      // Trending boost
      const trendingBoost = book.trending ? 0.1 : 0;

      // Rating boost
      const ratingBoost = (book.rating || 0) * 0.05;

      // Final score: personalization + collaborative + quality
      book._personalizationScore = personalizationScore;
      book._collaborativeScore = collaborativeScore;
      book._finalScore =
        personalizationScore + collaborativeScore + trendingBoost + ratingBoost;
    });

    // Sắp xếp theo cfScore từ cao xuống thấp (đảm bảo thứ tự đúng)
    // Nếu cfScore bằng nhau, sắp xếp theo finalScore
    books.sort((a, b) => {
      // Ưu tiên cfScore trước (sách có collaborative score cao hơn đứng trước)
      if (Math.abs(b._cfScore - a._cfScore) > 0.0001) {
        return b._cfScore - a._cfScore;
      }
      // Nếu cfScore bằng nhau, sắp xếp theo finalScore
      return b._finalScore - a._finalScore;
    });

    // Đảm bảo diversity: không quá nhiều books cùng category/author
    // Nhưng vẫn giữ thứ tự theo cfScore (sách có score cao nhất đứng đầu)
    const finalBooks = [];
    const categoryCount = {};
    const authorCount = {};
    const MAX_PER_CATEGORY = 3;
    const MAX_PER_AUTHOR = 2;

    // Vòng 1: Lấy sách theo thứ tự cfScore, áp dụng diversity filter
    for (const book of books) {
      const category = book.category?.name || "unknown";
      const author = book.author?.name || "unknown";

      if (
        (categoryCount[category] || 0) < MAX_PER_CATEGORY &&
        (authorCount[author] || 0) < MAX_PER_AUTHOR
      ) {
        finalBooks.push(book);
        categoryCount[category] = (categoryCount[category] || 0) + 1;
        authorCount[author] = (authorCount[author] || 0) + 1;

        if (finalBooks.length >= 10) break;
      }
    }

    // Vòng 2: Nếu chưa đủ, thêm books còn lại theo thứ tự cfScore (không cần diversity check)
    if (finalBooks.length < 10) {
      const finalBookIds = new Set(finalBooks.map((b) => b._id.toString()));
      for (const book of books) {
        if (!finalBookIds.has(book._id.toString())) {
          finalBooks.push(book);
          if (finalBooks.length >= 10) break;
        }
      }
    }

    // Loại bỏ các field tạm thời
    finalBooks.forEach((book) => {
      delete book._personalizationScore;
      delete book._collaborativeScore;
      delete book._finalScore;
    });

    const personalizedCount = finalBooks.filter((b) => {
      const bookId = b._id.toString();
      return (
        userPreferences.categories.has(b.category?.name) ||
        userPreferences.authors.has(b.author?.name) ||
        (Array.isArray(b.tags) &&
          b.tags.some((tag) => userPreferences.tags.has(tag)))
      );
    }).length;

    console.log(
      `Recommended ${finalBooks.length} books (${personalizedCount} personalized)`
    );

    // Nếu không đủ 10 quyển, bổ sung sách phổ biến để đủ 10 quyển
    // Collaborative filtering books đã đứng đầu, giờ bổ sung sách phổ biến vào cuối
    if (finalBooks.length < 10) {
      console.log(
        `Supplementing with popular books to reach 10 (currently ${finalBooks.length})`
      );
      const existingBookIds = new Set([
        ...finalBooks.map((b) => b._id.toString()),
        ...userBookIdsArray,
      ]);

      // Tìm sách phổ biến (không có trong danh sách đã có)
      const popularBooks = await Book.aggregate([
        {
          $match: {
            _id: {
              $nin: Array.from(existingBookIds).map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
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
            rating: { $ifNull: ["$rating", 0] },
            numReviews: { $ifNull: ["$numReviews", 0] },
            author: { _id: 1, name: 1 },
            category: { _id: 1, name: 1 },
            tags: 1,
            trending: 1,
          },
        },
        { $sort: { trending: -1, rating: -1, numReviews: -1 } },
        { $limit: 10 - finalBooks.length },
      ]);

      // Thêm popularBooks vào cuối (có cfScore = 0, sẽ đứng sau collaborative books)
      popularBooks.forEach((book) => {
        book._cfScore = 0;
        book._personalizationScore = 0;
        book._collaborativeScore = 0;
        book._finalScore =
          (book.rating || 0) * 0.05 + (book.trending ? 0.1 : 0);
      });

      finalBooks.push(...popularBooks);
      console.log(
        `Added ${popularBooks.length} popular books. Total: ${finalBooks.length}`
      );
    }

    // Đảm bảo trả về đúng finalBooks
    books = finalBooks;

    // FILTER CUỐI CÙNG: Loại bỏ sách user đã tương tác (đảm bảo real-time)
    // Sử dụng lại userInteractedBookIds đã tạo ở trên

    // Lọc lại để loại bỏ sách đã tương tác
    books = books.filter((book) => {
      const bookId = book._id.toString();
      return !userInteractedBookIds.has(bookId);
    });

    console.log(
      `After filtering interacted books: ${books.length} books remaining`
    );

    // Nếu sau khi filter không đủ 10 sách, bổ sung sách phổ biến
    if (books.length < 10) {
      console.log(
        `Not enough books after filtering (${books.length}/10), supplementing with popular books`
      );
      const existingBookIds = new Set([
        ...books.map((b) => b._id.toString()),
        ...userBookIdsArray,
      ]);

      const popularBooks = await Book.aggregate([
        {
          $match: {
            _id: {
              $nin: Array.from(existingBookIds).map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
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
            rating: { $ifNull: ["$rating", 0] },
            numReviews: { $ifNull: ["$numReviews", 0] },
            author: { _id: 1, name: 1 },
            category: { _id: 1, name: 1 },
            tags: 1,
            trending: 1,
          },
        },
        { $sort: { trending: -1, rating: -1, numReviews: -1 } },
        { $limit: 10 - books.length },
      ]);

      books.push(...popularBooks);
      console.log(
        `Added ${popularBooks.length} popular books. Total: ${books.length}`
      );
    }

    // Kiểm tra ngày lễ và ưu tiên sách liên quan
    const holidayContext = getHolidayContext();
    if (holidayContext.isHoliday || holidayContext.isNearHoliday) {
      console.log("Holiday context detected:", {
        isHoliday: holidayContext.isHoliday,
        isNearHoliday: holidayContext.isNearHoliday,
        holidays: holidayContext.holidays || holidayContext.upcomingHoliday,
        tags: holidayContext.tags,
      });

      // Tìm sách liên quan đến ngày lễ
      const matchConditions = [
        { tags: { $in: holidayContext.tags } },
        ...holidayContext.tags.map((tag) => ({
          title: { $regex: tag, $options: "i" },
        })),
        ...holidayContext.tags.map((tag) => ({
          description: { $regex: tag, $options: "i" },
        })),
      ];

      const holidayBooks = await Book.aggregate([
        {
          $match: {
            $or: matchConditions,
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
            rating: { $ifNull: ["$rating", 0] },
            numReviews: { $ifNull: ["$numReviews", 0] },
            author: { _id: 1, name: 1 },
            category: { _id: 1, name: 1 },
            tags: 1,
          },
        },
        { $sort: { rating: -1, numReviews: -1 } },
        { $limit: 5 },
      ]);

      if (holidayBooks.length > 0) {
        console.log(`Found ${holidayBooks.length} holiday-related books`);
        // Loại bỏ sách trùng lặp và ưu tiên sách ngày lễ ở đầu danh sách
        const existingBookIds = new Set(books.map((b) => b._id.toString()));
        const newHolidayBooks = holidayBooks.filter(
          (b) => !existingBookIds.has(b._id.toString())
        );
        // Thêm sách ngày lễ vào đầu danh sách
        books.unshift(...newHolidayBooks);
        // Giới hạn lại số lượng
        books.splice(10);

        // FILTER LẠI: Loại bỏ sách user đã tương tác (sau khi thêm holiday books)
        books = books.filter((book) => {
          const bookId = book._id.toString();
          return !userInteractedBookIds.has(bookId);
        });
      }
    }

    // FILTER CUỐI CÙNG TRƯỚC KHI TRẢ VỀ: Đảm bảo không có sách đã tương tác
    books = books.filter((book) => {
      const bookId = book._id.toString();
      return !userInteractedBookIds.has(bookId);
    });

    console.log(
      `Final recommendations: ${books.length} books (after filtering all interacted books)`
    );

    // ĐẢM BẢO LUÔN CÓ ĐỦ 10 SÁCH: Nếu sau tất cả filter vẫn không đủ, bổ sung sách phổ biến
    if (books.length < 10) {
      console.log(
        `⚠️ Warning: Only ${books.length} books after all filters. Supplementing to reach 10.`
      );
      const existingBookIds = new Set([
        ...books.map((b) => b._id.toString()),
        ...userBookIdsArray,
      ]);

      const additionalPopularBooks = await Book.aggregate([
        {
          $match: {
            _id: {
              $nin: Array.from(existingBookIds).map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
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
            rating: { $ifNull: ["$rating", 0] },
            numReviews: { $ifNull: ["$numReviews", 0] },
            author: { _id: 1, name: 1 },
            category: { _id: 1, name: 1 },
            tags: 1,
            trending: 1,
          },
        },
        { $sort: { trending: -1, rating: -1, numReviews: -1 } },
        { $limit: 10 - books.length },
      ]);

      books.push(...additionalPopularBooks);
      console.log(
        `✅ Added ${additionalPopularBooks.length} additional popular books. Final total: ${books.length} books`
      );
    }

    // Giới hạn tối đa 10 sách
    books = books.slice(0, 10);

    res.status(200).json({
      data: books,
      context:
        holidayContext.isHoliday || holidayContext.isNearHoliday
          ? {
              isHoliday: holidayContext.isHoliday,
              isNearHoliday: holidayContext.isNearHoliday,
              holidayName:
                holidayContext.holidays?.[0] ||
                holidayContext.upcomingHoliday ||
                null,
            }
          : null,
    });
  } catch (error) {
    console.error("Collaborative recommendation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Lấy gợi ý sách theo ngữ cảnh (ngày lễ)
 * Trả về sách liên quan đến ngày lễ hiện tại hoặc sắp tới
 */
exports.getContextualRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const holidayContext = getHolidayContext();

    console.log("Contextual recommendation - Holiday context:", holidayContext);

    const limit = Number(req.query?.limit) || 20;
    const { books, debug } = await getContextualModelRecommendations({
      holidayContext:
        holidayContext.isHoliday || holidayContext.isNearHoliday
          ? holidayContext
          : null,
      limit,
    });

    const responseContext =
      holidayContext.isHoliday || holidayContext.isNearHoliday
        ? {
            isHoliday: holidayContext.isHoliday,
            isNearHoliday: holidayContext.isNearHoliday,
            holidayName: holidayContext.holidayName,
            daysUntil: holidayContext.daysUntil,
            tags: holidayContext.tags,
            modelTokens: debug.tokens,
          }
        : {
            isHoliday: false,
            isNearHoliday: false,
            holidayName: "Sách nổi bật",
            tags: ["trending", "popular"],
            modelTokens: debug.tokens,
          };

    res.status(200).json({
      data: books,
      context: responseContext,
    });
  } catch (error) {
    console.error("Contextual recommendation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
