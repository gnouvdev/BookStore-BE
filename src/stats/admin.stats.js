const mongoose = require("mongoose");
const express = require("express");
const Order = require("../orders/order.model");
const Book = require("../books/book.model");
const User = require("../users/user.model");
const router = express.Router();

// Middleware to check database connection
const checkDatabaseConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error(
        "Database not connected. Current state:",
        mongoose.connection.readyState
      );
      return res.status(500).json({
        message: "Database connection error",
        state: mongoose.connection.readyState,
      });
    }
    next();
  } catch (error) {
    console.error("Database connection check failed:", error);
    res.status(500).json({
      message: "Database connection check failed",
      error: error.message,
    });
  }
};

// Apply middleware to all routes
router.use(checkDatabaseConnection);

// Function to calculate admin stats
router.get("/", async (req, res) => {
  try {
    console.log("Fetching admin stats...");
    console.log("Database state:", mongoose.connection.readyState);
    console.log("Database name:", mongoose.connection.name);

    // Check if models are properly defined
    if (!Order || !Book || !User) {
      console.error("Models not properly defined:", {
        Order: !!Order,
        Book: !!Book,
        User: !!User,
      });
      return res
        .status(500)
        .json({ message: "Models not properly initialized" });
    }

    // Test basic queries
    try {
      const testOrder = await Order.findOne().lean();
      console.log(
        "Test order query:",
        testOrder ? "Success" : "No orders found"
      );

      const testBook = await Book.findOne().lean();
      console.log("Test book query:", testBook ? "Success" : "No books found");

      const testUser = await User.findOne().lean();
      console.log("Test user query:", testUser ? "Success" : "No users found");
    } catch (queryError) {
      console.error("Test queries failed:", queryError);
      return res.status(500).json({
        message: "Database queries failed",
        error: queryError.message,
      });
    }

    // 1. Total number of orders
    const totalOrders = await Order.countDocuments();
    console.log("Total Orders:", totalOrders);

    if (totalOrders === 0) {
      console.log("No orders found in database");
      return res.status(200).json({
        totalOrders: 0,
        totalSales: 0,
        trendingBooks: 0,
        totalBooks: 0,
        monthlySales: [],
        topUsers: [],
        recentOrders: [],
        topSellingBooks: [],
        averageOrderValue: 0,
        totalUsers: 0,
        pendingOrders: 0,
        completedOrders: 0,
        message: "No data available",
      });
    }

    // 2. Total sales
    const totalSales = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: {
              $convert: {
                input: { $ifNull: ["$totalPrice", 0] },
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);
    console.log("Total Sales Result:", totalSales);

    // 3. Top users
    console.log("Fetching top users...");

    // Debug: Check orders with user field
    const sampleOrders = await Order.find({ user: { $exists: true } })
      .limit(3)
      .lean();
    console.log(
      "Sample orders with user:",
      JSON.stringify(sampleOrders, null, 2)
    );

    // Debug: Check user IDs in orders
    const topUserOrderIds = await Order.distinct("user");
    console.log("Distinct user IDs in orders:", topUserOrderIds);

    // Debug: Check if these users exist
    const existingUsers = await User.find({
      _id: { $in: topUserOrderIds },
    }).lean();
    console.log("Existing users found:", existingUsers.length);
    console.log("Sample user data:", JSON.stringify(existingUsers[0], null, 2));

    const ordersWithUsers = await Order.countDocuments({
      user: { $exists: true, $ne: null },
    });
    console.log("Orders with users:", ordersWithUsers);

    const topUsers = await Order.aggregate([
      // First, match orders that have a user field
      {
        $match: {
          user: { $exists: true, $ne: null },
        },
      },
      // Convert user field to ObjectId if it's a string
      {
        $addFields: {
          userId: {
            $cond: {
              if: { $eq: [{ $type: "$user" }, "string"] },
              then: { $toObjectId: "$user" },
              else: "$user",
            },
          },
        },
      },
      // Lookup users
      {
        $lookup: {
          from: "users",
          let: { userId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$userId"] },
              },
            },
            {
              $project: {
                _id: 1,
                fullName: 1,
                email: 1,
                photoURL: 1,
                role: 1,
              },
            },
          ],
          as: "userInfo",
        },
      },
      // Debug stage
      {
        $addFields: {
          debug_userInfo: "$userInfo",
          debug_userInfoLength: { $size: "$userInfo" },
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: false,
        },
      },
      // Match non-admin users
      {
        $match: {
          "userInfo.role": { $ne: "admin" },
        },
      },
      // Convert price to number
      {
        $addFields: {
          convertedTotalPrice: {
            $convert: {
              input: { $ifNull: ["$totalPrice", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      // Group by user
      {
        $group: {
          _id: "$userId",
          name: { $first: "$userInfo.fullName" },
          email: { $first: "$userInfo.email" },
          avatar: { $first: "$userInfo.photoURL" },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$convertedTotalPrice" },
          lastOrderDate: { $max: "$createdAt" },
          averageOrderValue: { $avg: "$convertedTotalPrice" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      // Sort by total spent
      {
        $sort: { totalSpent: -1 },
      },
      // Limit to top 10
      {
        $limit: 10,
      },
    ]);

    // Debug: Log the result
    console.log(
      "Top Users Pipeline Result:",
      JSON.stringify(topUsers, null, 2)
    );
    console.log("Number of top users found:", topUsers.length);

    // 4. Trending books
    const trendingBooksCount = await Book.aggregate([
      { $match: { trending: true } },
      { $count: "trendingBooksCount" },
    ]);
    const trendingBooks =
      trendingBooksCount.length > 0
        ? trendingBooksCount[0].trendingBooksCount
        : 0;
    console.log("Trending Books:", trendingBooks);

    // 5. Total books
    const totalBooks = await Book.countDocuments();
    console.log("Total Books:", totalBooks);

    // 6. Monthly sales
    console.log("Fetching monthly sales...");
    const monthlySales = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: { $toDouble: "$totalPrice" } },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: { $toDouble: "$totalPrice" } },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalSales: 1,
          totalOrders: 1,
          averageOrderValue: 1,
          monthName: {
            $let: {
              vars: {
                months: [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ],
              },
              in: {
                $arrayElemAt: ["$$months", { $subtract: ["$_id.month", 1] }],
              },
            },
          },
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);
    console.log("Monthly Sales Result:", JSON.stringify(monthlySales, null, 2));

    // 7. Recent orders
    console.log("Fetching recent orders...");

    // Debug: Check all orders first
    const allOrders = await Order.find().lean();
    console.log("Total orders in database:", allOrders.length);
    console.log("Sample order:", JSON.stringify(allOrders[0], null, 2));

    const recentOrders = await Order.aggregate([
      // Match orders that have a user field
      {
        $match: {
          user: { $exists: true, $ne: null },
        },
      },
      // Simple lookup for user information
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      // Debug stage
      {
        $addFields: {
          debug_userInfo: "$userInfo",
        },
      },
      // Unwind userInfo array
      {
        $unwind: "$userInfo",
      },
      // Sort by creation date
      {
        $sort: { createdAt: -1 },
      },
      // Limit to 5 most recent orders
      {
        $limit: 5,
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          totalPrice: 1,
          status: 1,
          createdAt: 1,
          productIds: 1,
          user: {
            fullName: "$userInfo.fullName",
            email: "$userInfo.email",
            photoURL: "$userInfo.photoURL",
          },
        },
      },
    ]);

    // Debug: Log the result
    console.log("Recent Orders Result:", JSON.stringify(recentOrders, null, 2));
    console.log("Recent Orders Count:", recentOrders.length);

    // 8. Top selling books
    console.log("Fetching top selling books...");
    const topSellingBooks = await Order.aggregate([
      // Unwind productIds array
      { $unwind: "$productIds" },
      // Lookup book information
      {
        $lookup: {
          from: "books",
          let: { productId: "$productIds.productId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$productId"] },
              },
            },
            {
              $project: {
                _id: 1,
                title: 1,
                coverImage: 1,
                author: 1,
                price: 1,
                stock: 1,
              },
            },
          ],
          as: "bookInfo",
        },
      },
      // Unwind bookInfo array
      { $unwind: "$bookInfo" },
      // Add debug fields
      {
        $addFields: {
          debug_product: "$productIds",
          debug_book: "$bookInfo",
        },
      },
      // Convert price and quantity to numbers
      {
        $addFields: {
          price: {
            $convert: {
              input: { $ifNull: ["$bookInfo.price", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          quantity: {
            $convert: {
              input: { $ifNull: ["$productIds.quantity", 0] },
              to: "int",
              onError: 0,
              onNull: 0,
            },
          },
          stock: {
            $convert: {
              input: { $ifNull: ["$bookInfo.stock", 0] },
              to: "int",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      // Calculate revenue for each item
      {
        $addFields: {
          itemRevenue: { $multiply: ["$price", "$quantity"] },
        },
      },
      // Group by book
      {
        $group: {
          _id: "$productIds.productId",
          title: { $first: "$bookInfo.title" },
          coverImage: { $first: "$bookInfo.coverImage" },
          author: { $first: "$bookInfo.author" },
          price: { $first: "$price" },
          stock: { $first: "$stock" },
          totalSold: { $sum: "$quantity" },
          totalRevenue: { $sum: "$itemRevenue" },
          orderCount: { $sum: 1 },
        },
      },
      // Add percentage of stock sold
      {
        $addFields: {
          stockPercentage: {
            $cond: {
              if: { $gt: ["$stock", 0] },
              then: { $multiply: [{ $divide: ["$totalSold", "$stock"] }, 100] },
              else: 0,
            },
          },
        },
      },
      // Sort by total sold
      { $sort: { totalSold: -1 } },
      // Limit to top 10
      { $limit: 10 },
    ]);

    // Debug log
    console.log(
      "Top Selling Books Sample:",
      JSON.stringify(topSellingBooks.slice(0, 2), null, 2)
    );

    // Result summary
    const result = {
      totalOrders,
      totalSales: totalSales[0]?.totalSales || 0,
      trendingBooks,
      totalBooks,
      monthlySales,
      topUsers,
      recentOrders,
      topSellingBooks,
      averageOrderValue: totalSales[0]?.totalSales / totalOrders || 0,
      totalUsers: await User.countDocuments(),
      pendingOrders: await Order.countDocuments({ status: "pending" }),
      completedOrders: await Order.countDocuments({ status: "completed" }),
    };

    console.log("Final Response Summary:", {
      totalOrders: result.totalOrders,
      totalSales: result.totalSales,
      topUsersCount: result.topUsers.length,
      topSellingBooksCount: result.topSellingBooks.length,
      monthlySalesCount: result.monthlySales.length,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in admin stats:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      message: "Failed to fetch admin stats",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      details: {
        name: error.name,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
      },
    });
  }
});

module.exports = router;
