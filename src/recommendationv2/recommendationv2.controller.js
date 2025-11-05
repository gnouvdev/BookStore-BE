const Order = require("../orders/order.model");
const Review = require("../reviews/review.model");
const Cart = require("../cart/cart.model");
const ViewHistory = require("../viewHistory/viewHistory.model");
const SearchHistory = require("../searchHistory/searchHistory.model");
const Book = require("../books/book.model");
const User = require("../users/user.model");
const mongoose = require("mongoose");
const specialEvents = require("../utils/specialEvents");
const moment = require("moment");

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

    // Get contextual recommendations
    const today = moment().format("DD/MM");
    const event = specialEvents.find((e) => e.date === today);
    let contextualBooks = [];
    if (event) {
      contextualBooks = await Book.find({
        $or: [
          { title: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
          { description: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
          { tags: { $in: event.keywords.map((kw) => new RegExp(kw, "i")) } },
        ],
      })
        .limit(5)
        .populate("author", "name")
        .populate("category", "name");
    }

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
    const views = await ViewHistory.find({ user: userId })
      .select("book")
      .sort({ timestamp: -1 })
      .limit(100);
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

    // Tạo tập userBookIds với trọng số
    const userBookIds = {};
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
      order.productIds.forEach((item) => {
        if (item.productId && item.productId._id) {
          userBookIds[item.productId._id.toString()] = 1.0; // Mua
        } else {
          console.warn("Skipping order item with missing productId:", item);
        }
      });
    });
    reviews.forEach((review) => {
      if (review.book) {
        userBookIds[review.book.toString()] = review.rating / 4; // Tăng trọng số
      }
    });
    carts.forEach((cart) => {
      if (cart.items && Array.isArray(cart.items)) {
        cart.items.forEach((item) => {
          if (item.book && item.book._id) {
            userBookIds[item.book._id.toString()] = 0.8; // Giỏ hàng
          }
        });
      }
    });
    views.forEach((view) => {
      if (view.book) {
        userBookIds[view.book.toString()] = 0.5; // Xem
      }
    });
    if (user && user.wishlist && Array.isArray(user.wishlist)) {
      user.wishlist.forEach((book) => {
        if (book && book._id) {
          userBookIds[book._id.toString()] = 0.7; // Wishlist
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

    // Nếu không đủ dữ liệu, trả về sách phổ biến
    if (Object.keys(userBookIds).length < 3) {
      console.log("Not enough user data, returning popular books");
      const popularBooks = await Book.find({
        _id: { $nin: contextualBooks.map(b => b._id) }
      })
        .sort({ numReviews: -1, rating: -1 })
        .limit(10 - contextualBooks.length)
        .populate("author", "name")
        .populate("category", "name");

      const finalRecommendations = [...contextualBooks, ...popularBooks];
      return res.status(200).json({ data: finalRecommendations, message: event ? event.message : "Popular books" });
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

    for (const userId in otherUsersBooks) {
      const otherBookIds = otherUsersBooks[userId];
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
      similarities[userId] = normA && normB ? dotProduct / (normA * normB) : 0;
    }

    console.log(
      "Top similarities:",
      Object.entries(similarities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    );

    // Lấy top 5 người dùng tương tự
    const topSimilarUsers = Object.keys(similarities)
      .sort((a, b) => similarities[b] - similarities[a])
      .slice(0, 5);

    // Thu thập sách gợi ý
    let recommendedBooks = [];
    topSimilarUsers.forEach((userId) => {
      const books = otherUsersBooks[userId];
      for (const bookId in books) {
        if (!userBookIds[bookId]) {
          recommendedBooks.push(bookId);
        }
      }
    });

    // Loại trùng lặp và lấy chi tiết sách
    recommendedBooks = [...new Set(recommendedBooks)];
    const books = await Book.aggregate([
      {
        $match: {
          _id: {
            $in: recommendedBooks.map((id) => new mongoose.Types.ObjectId(id)),
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
        },
      },
      { $limit: 10 },
    ]);

    console.log(`Recommended ${books.length} books`);

    // Nếu không đủ gợi ý, bổ sung sách phổ biến
    if (books.length < 5) {
      console.log("Supplementing with popular books");
      const additionalBooks = await Book.aggregate([
        {
          $match: {
            _id: {
              $nin: [
                ...recommendedBooks.map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
                ...Object.keys(userBookIds).map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
              ],
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
          },
        },
        { $sort: { numReviews: -1, rating: -1 } },
        { $limit: 10 - books.length },
      ]);
      books.push(...additionalBooks);
    }

    const finalRecommendations = [...contextualBooks];
    const contextualBookIds = new Set(contextualBooks.map(b => b._id.toString()));

    for (const book of books) {
      if (!contextualBookIds.has(book._id.toString())) {
        finalRecommendations.push(book);
      }
    }

    res.status(200).json({ data: finalRecommendations.slice(0, 10), message: event ? event.message : "Recommendations generated successfully" });
  } catch (error) {
    console.error("Collaborative recommendation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
