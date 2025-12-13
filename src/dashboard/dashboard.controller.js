const Order = require("../orders/order.model");
const Book = require("../books/book.model");
const User = require("../users/user.model");
const SearchHistory = require("../searchHistory/searchHistory.model");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Chat = require("../chat/chat.model");
const ExcelJS = require("exceljs");

// Hàm helper để tạo điều kiện lọc theo ngày
const createDateFilter = (req) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return {};

  return {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };
};

// Lấy tổng quan dashboard
const getDashboardOverview = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);

    // Tổng số sách
    const totalBooks = await Book.countDocuments();

    // Tổng doanh thu
    const totalSales = await Order.aggregate([
      {
        $match: { ...dateFilter, status: { $in: ["delivered", "completed"] } },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    // Tổng số đơn hàng
    const totalOrders = await Order.countDocuments(dateFilter);

    // Tổng số người dùng
    const totalUsers = await User.countDocuments({ role: "user" });

    // Đơn hàng đang xử lý
    const pendingOrders = await Order.countDocuments({
      ...dateFilter,
      status: "pending",
    });

    // Đơn hàng đã hoàn thành
    const completedOrders = await Order.countDocuments({
      ...dateFilter,
      status: "completed",
    });

    // Đơn hàng đang xử lý
    const processingOrders = await Order.countDocuments({
      ...dateFilter,
      status: "processing",
    });

    // Giá trị đơn hàng trung bình
    const avgOrderValue = await Order.aggregate([
      {
        $match: { ...dateFilter, status: { $in: ["delivered", "completed"] } },
      },
      { $group: { _id: null, avg: { $avg: "$totalPrice" } } },
    ]);

    // Sách đang trend
    const trendingBooks = await Book.countDocuments({ trending: true });

    res.status(200).json({
      totalBooks,
      totalSales: totalSales[0]?.total || 0,
      totalOrders,
      totalUsers,
      pendingOrders,
      completedOrders,
      processingOrders,
      averageOrderValue: avgOrderValue[0]?.avg || 0,
      trendingBooks,
    });
  } catch (error) {
    console.error("Error getting dashboard overview:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy dữ liệu doanh số theo tháng
const getMonthlySales = async (req, res) => {
  try {
    // Tính toán ngày bắt đầu (6 tháng trước)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const monthlySales = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
          status: { $in: ["delivered", "completed"] },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalSales: 1,
          totalOrders: 1,
          monthName: {
            $let: {
              vars: {
                months: [
                  "Tháng 1",
                  "Tháng 2",
                  "Tháng 3",
                  "Tháng 4",
                  "Tháng 5",
                  "Tháng 6",
                  "Tháng 7",
                  "Tháng 8",
                  "Tháng 9",
                  "Tháng 10",
                  "Tháng 11",
                  "Tháng 12",
                ],
              },
              in: {
                $arrayElemAt: ["$$months", { $subtract: ["$_id.month", 1] }],
              },
            },
          },
          averageOrderValue: {
            $divide: ["$totalSales", "$totalOrders"],
          },
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);

    // Tạo mảng chứa tất cả các tháng trong khoảng thời gian
    const allMonths = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // Kiểm tra xem tháng này đã có trong kết quả chưa
      const existingMonth = monthlySales.find(
        (m) => m.year === year && m.month === month
      );

      if (!existingMonth) {
        // Nếu chưa có, thêm vào với giá trị 0
        allMonths.push({
          year,
          month,
          totalSales: 0,
          totalOrders: 0,
          monthName: `Tháng ${month}`,
          averageOrderValue: 0,
        });
      } else {
        allMonths.push(existingMonth);
      }

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    res.status(200).json(allMonths);
  } catch (error) {
    console.error("Error getting monthly sales:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy danh sách đơn hàng gần đây
const getRecentOrders = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);
    const recentOrders = await Order.find(dateFilter)
      .sort({ createdAt: -1 })
      .populate("user", "fullName email photoURL")
      .populate("paymentMethod", "name");

    // Lấy thống kê trạng thái đơn hàng
    const orderStats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Chuyển đổi thống kê thành object
    const stats = orderStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    res.status(200).json({
      orders: recentOrders,
      stats: {
        pending: stats.pending || 0,
        processing: stats.processing || 0,
        shipped: stats.shipped || 0,
        delivered: stats.delivered || 0,
        completed: stats.completed || 0,
        cancelled: stats.cancelled || 0,
      },
    });
  } catch (error) {
    console.error("Error getting recent orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy danh sách sách bán chạy
const getTopSellingBooks = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);

    // Lấy thống kê tồn kho trước
    const inventoryStats = await Book.aggregate([
      {
        $group: {
          _id: null,
          totalBooks: { $sum: 1 },
          outOfStock: {
            $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] },
          },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$quantity", 0] },
                    { $lte: ["$quantity", 10] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          inStock: {
            $sum: {
              $cond: [{ $gt: ["$quantity", 10] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Lấy số lượng sách cho mỗi category
    const categoryStats = await Book.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $unwind: "$categoryDetails",
      },
      {
        $project: {
          _id: 1,
          name: "$categoryDetails.name",
          count: 1,
          totalQuantity: 1,
        },
      },
    ]);

    // Lấy top sách bán chạy
    const topBooks = await Order.aggregate([
      {
        $match: { ...dateFilter, status: { $in: ["delivered", "completed"] } },
      },
      { $unwind: "$productIds" },
      {
        $group: {
          _id: "$productIds.productId",
          totalSold: { $sum: "$productIds.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: [
                "$productIds.quantity",
                { $divide: ["$totalPrice", { $sum: "$productIds.quantity" }] },
              ],
            },
          },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "_id",
          as: "bookDetails",
        },
      },
      { $unwind: "$bookDetails" },
      {
        $project: {
          _id: "$_id",
          title: "$bookDetails.title",
          author: "$bookDetails.author",
          coverImage: "$bookDetails.coverImage",
          totalSold: 1,
          totalRevenue: 1,
          orderCount: 1,
          stock: "$bookDetails.quantity",
          category: "$bookDetails.category",
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      books: topBooks,
      stats: inventoryStats[0] || {
        totalBooks: 0,
        outOfStock: 0,
        lowStock: 0,
        inStock: 0,
      },
      categoryStats: categoryStats || [],
    });
  } catch (error) {
    console.error("Error getting top selling books:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy danh sách người dùng
const getUsers = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);
    const users = await User.find({ role: "user", ...dateFilter })
      .select("fullName email phone createdAt")
      .sort({ createdAt: -1 });

    // Lấy thông tin đơn hàng cho mỗi người dùng
    const usersWithOrders = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({ user: user._id });
        const totalSpent = orders.reduce(
          (sum, order) => sum + order.totalPrice,
          0
        );
        const lastOrder = orders[0]?.createdAt || null;

        return {
          ...user.toObject(),
          totalOrders: orders.length,
          totalSpent,
          lastOrder,
        };
      })
    );

    // Lấy thống kê vai trò người dùng
    const roleStats = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Chuyển đổi thống kê thành object
    const stats = roleStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    res.status(200).json({
      users: usersWithOrders,
      stats: {
        user: stats.user || 0,
        admin: stats.admin || 0,
        staff: stats.staff || 0,
      },
    });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Xuất báo cáo
const exportReport = async (req, res) => {
  try {
    const { type } = req.params;
    const dateFilter = createDateFilter(req);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    switch (type) {
      case "sales": {
        // Lấy dữ liệu doanh số
        const salesData = await Order.aggregate([
          {
            $match: {
              ...dateFilter,
              status: { $in: ["delivered", "completed"] },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
              },
              totalSales: { $sum: "$totalPrice" },
              orderCount: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        ]);

        // Tạo header
        worksheet.columns = [
          { header: "Ngày", key: "date", width: 15 },
          { header: "Doanh thu", key: "totalSales", width: 20 },
          { header: "Số đơn hàng", key: "orderCount", width: 15 },
        ];

        // Thêm dữ liệu
        salesData.forEach((item) => {
          worksheet.addRow({
            date: `${item._id.day}/${item._id.month}/${item._id.year}`,
            totalSales: item.totalSales,
            orderCount: item.orderCount,
          });
        });

        break;
      }
      case "orders": {
        // Lấy dữ liệu đơn hàng
        const orders = await Order.find(dateFilter)
          .populate("user", "fullName email")
          .populate("paymentMethod", "name");

        // Tạo header
        worksheet.columns = [
          { header: "Mã đơn hàng", key: "orderId", width: 15 },
          { header: "Khách hàng", key: "customer", width: 30 },
          { header: "Trạng thái", key: "status", width: 15 },
          { header: "Tổng tiền", key: "total", width: 15 },
          { header: "Ngày tạo", key: "createdAt", width: 20 },
        ];

        // Thêm dữ liệu
        orders.forEach((order) => {
          worksheet.addRow({
            orderId: order._id.toString().slice(-6),
            customer: order.user.fullName,
            status: order.status,
            total: order.totalPrice,
            createdAt: order.createdAt.toLocaleDateString(),
          });
        });

        break;
      }
      case "users": {
        // Lấy dữ liệu người dùng
        const users = await User.find({ role: "user" });

        // Tạo header
        worksheet.columns = [
          { header: "Tên", key: "name", width: 30 },
          { header: "Email", key: "email", width: 30 },
          { header: "Số điện thoại", key: "phone", width: 15 },
          { header: "Ngày tạo", key: "createdAt", width: 20 },
        ];

        // Thêm dữ liệu
        users.forEach((user) => {
          worksheet.addRow({
            name: user.fullName,
            email: user.email,
            phone: user.phone || "",
            createdAt: user.createdAt.toLocaleDateString(),
          });
        });

        break;
      }
      case "inventory": {
        // Lấy dữ liệu sách
        const books = await Book.find();

        // Tạo header
        worksheet.columns = [
          { header: "Tên sách", key: "title", width: 40 },
          { header: "Tác giả", key: "author", width: 30 },
          { header: "Giá", key: "price", width: 15 },
          { header: "Tồn kho", key: "stock", width: 15 },
        ];

        // Thêm dữ liệu
        books.forEach((book) => {
          worksheet.addRow({
            title: book.title,
            author: book.author,
            price: book.price.newPrice,
            stock: book.quantity,
          });
        });

        break;
      }
    }

    // Gửi file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${type}-report.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getBusinessInsights = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const previousMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    const [
      searchCurrent,
      searchPrev,
      viewsCurrent,
      wishlistAgg,
      chatbotAgg,
      ordersCurrent,
      ordersPrev,
      trendingBooks,
      ordersByDay,
      ordersByCategoryCurrent,
      ordersByCategoryPrev,
    ] = await Promise.all([
      SearchHistory.aggregate([
        { $match: { timestamp: { $gte: startOfMonth } } },
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      SearchHistory.aggregate([
        {
          $match: {
            timestamp: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: "$query", count: { $sum: 1 } } },
      ]),
      ViewHistory.aggregate([
        { $match: { timestamp: { $gte: startOfMonth } } },
        { $group: { _id: "$book", views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 50 },
      ]),
      User.aggregate([
        { $match: { wishlist: { $exists: true, $ne: [] } } },
        { $unwind: "$wishlist" },
        { $group: { _id: "$wishlist", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Chat.aggregate([
        {
          $match: {
            senderId: "chatbot",
            books: { $exists: true, $ne: [] },
            createdAt: { $gte: startOfMonth },
          },
        },
        { $unwind: "$books" },
        {
          $group: {
            _id: "$books._id",
            count: { $sum: 1 },
            title: { $first: "$books.title" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $unwind: "$productIds" },
        {
          $group: {
            _id: "$productIds.productId",
            quantity: { $sum: "$productIds.quantity" },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $unwind: "$productIds" },
        {
          $group: {
            _id: "$productIds.productId",
            quantity: { $sum: "$productIds.quantity" },
          },
        },
      ]),
      Book.find({ trending: true })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate("author", "name")
        .populate("category", "name")
        .lean(),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $project: {
            day: { $dayOfMonth: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$day",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $unwind: "$productIds" },
        {
          $lookup: {
            from: "books",
            localField: "productIds.productId",
            foreignField: "_id",
            as: "book",
          },
        },
        { $unwind: "$book" },
        {
          $lookup: {
            from: "categories",
            localField: "book.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category.name",
            quantity: { $sum: "$productIds.quantity" },
          },
        },
        { $sort: { quantity: -1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $unwind: "$productIds" },
        {
          $lookup: {
            from: "books",
            localField: "productIds.productId",
            foreignField: "_id",
            as: "book",
          },
        },
        { $unwind: "$book" },
        {
          $lookup: {
            from: "categories",
            localField: "book.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category.name",
            quantity: { $sum: "$productIds.quantity" },
          },
        },
      ]),
    ]);

    const bookIdSet = new Set();
    const addId = (value) => {
      if (!value) return;
      const str = value.toString();
      if (str) bookIdSet.add(str);
    };

    viewsCurrent.forEach((item) => addId(item._id));
    wishlistAgg.forEach((item) => addId(item._id));
    chatbotAgg.forEach((item) => addId(item._id));
    ordersCurrent.forEach((item) => addId(item._id));

    const referencedBooks = await Book.find({
      _id: { $in: Array.from(bookIdSet) },
    })
      .populate("author", "name")
      .populate("category", "name")
      .lean();

    const bookMap = new Map(
      referencedBooks.map((book) => [book._id.toString(), book])
    );

    const searchPrevMap = new Map(
      searchPrev.map((item) => [item._id, item.count])
    );

    const searchTrends = searchCurrent.slice(0, 6).map((item) => {
      const prev = searchPrevMap.get(item._id) || 0;
      const change = prev === 0 ? 100 : ((item.count - prev) / prev) * 100;
      return {
        query: item._id,
        count: item.count,
        change: Number(change.toFixed(1)),
      };
    });

    const wishlistCountMap = new Map(
      wishlistAgg.map((item) => [item._id?.toString(), item.count])
    );
    const viewMap = new Map(
      viewsCurrent.map((item) => [item._id?.toString(), item.views])
    );
    const orderMap = new Map(
      ordersCurrent.map((item) => [item._id?.toString(), item.quantity])
    );

    const wishlistLeaders = wishlistAgg.slice(0, 5).map((item) => ({
      bookId: item._id?.toString(),
      count: item.count,
      book: bookMap.get(item._id?.toString()) || null,
    }));

    const chatbotHot = chatbotAgg.slice(0, 5).map((item) => ({
      bookId: item._id?.toString(),
      hits: item.count,
      title: item.title,
      book: bookMap.get(item._id?.toString()) || null,
    }));

    const lowConversion = viewsCurrent
      .filter((item) => item.views >= 5)
      .map((item) => {
        const id = item._id?.toString();
        const sold = orderMap.get(id) || 0;
        const conversion = item.views
          ? Number(((sold / item.views) * 100).toFixed(1))
          : 0;
        return {
          bookId: id,
          views: item.views,
          sold,
          conversion,
          book: bookMap.get(id) || null,
        };
      })
      .filter((item) => item.sold <= 1)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const topInsights = [];
    if (searchTrends[0]) {
      const trend = searchTrends[0];
      const direction = trend.change >= 0 ? "tăng" : "giảm";
      topInsights.push(
        `🔥 "${trend.query}" ${direction} ${Math.abs(
          trend.change
        )}% lượt tìm kiếm so với tháng trước.`
      );
    }
    if (lowConversion[0]?.book) {
      topInsights.push(
        `⚠️ "${lowConversion[0].book.title}" được xem ${lowConversion[0].views} lần nhưng hầu như chưa có đơn. Nên xem lại giá hoặc banner.`
      );
    }
    if (wishlistLeaders[0]?.book) {
      topInsights.push(
        `💖 "${wishlistLeaders[0].book.title}" đang có ${wishlistLeaders[0].count} người thêm wishlist.`
      );
    }
    if (chatbotHot[0]) {
      topInsights.push(
        `🤖 Chatbot giới thiệu "${
          chatbotHot[0].book?.title || chatbotHot[0].title
        }" ${chatbotHot[0].hits} lần trong tháng này.`
      );
    }

    const trendingList = trendingBooks.map((book) => ({
      bookId: book._id.toString(),
      book,
    }));

    const recommendations = {
      stockUp: wishlistLeaders.slice(0, 3).map((item) => ({
        title: item.book?.title || "Sách",
        reason: `${item.count} lượt wishlist`,
      })),
      highlight: [
        ...chatbotHot.slice(0, 2).map((item) => ({
          title: item.book?.title || item.title,
          reason: "Chatbot gợi ý nhiều, nên pin banner",
        })),
        ...trendingList.slice(0, 2).map((item) => ({
          title: item.book.title,
          reason: "Đang có nhãn trending",
        })),
      ],
      drop: [],
      timing: [],
    };

    const categoryTotals = {};
    referencedBooks.forEach((book) => {
      const categoryName = book.category?.name || "Khác";
      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { views: 0, wishlist: 0, sold: 0 };
      }
      const key = book._id.toString();
      categoryTotals[categoryName].views += viewMap.get(key) || 0;
      categoryTotals[categoryName].wishlist += wishlistCountMap.get(key) || 0;
      categoryTotals[categoryName].sold += orderMap.get(key) || 0;
    });

    const dropCandidates = Object.entries(categoryTotals)
      .filter(
        ([, value]) =>
          value.views < 3 && value.wishlist === 0 && value.sold === 0
      )
      .map(([category, stats]) => ({
        category,
        stats,
      }))
      .slice(0, 3);

    recommendations.drop = dropCandidates.map((candidate) => ({
      title: candidate.category,
      reason: "Ít lượt xem/wishlist, cân nhắc giảm tồn",
    }));

    const ordersByDayWindow = {};
    ordersByDay.forEach((entry) => {
      if (!entry?._id) return;
      const window =
        entry._id <= 10 ? "01-10" : entry._id <= 20 ? "11-20" : "21-31";
      ordersByDayWindow[window] =
        (ordersByDayWindow[window] || 0) + entry.count;
    });

    recommendations.timing = Object.entries(ordersByDayWindow)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([window, count]) => ({
        window,
        reason: `${count} đơn trong khoảng này – nên chạy banner/flash sale`,
      }));

    const categoryPrevMap = new Map(
      ordersByCategoryPrev.map((item) => [item._id, item.quantity])
    );
    const categoryTrends = ordersByCategoryCurrent.slice(0, 5).map((item) => {
      const prev = categoryPrevMap.get(item._id) || 0;
      const change =
        prev === 0
          ? 100
          : Number((((item.quantity - prev) / prev) * 100).toFixed(1));
      return {
        category: item._id,
        quantity: item.quantity,
        change,
      };
    });

    res.status(200).json({
      timeframe: {
        currentMonth: startOfMonth,
        previousMonthStart,
      },
      topInsights,
      metrics: {
        searchTrends,
        wishlistLeaders,
        chatbotHot,
        lowConversion,
        trendingBooks: trendingList,
        categoryTrends,
      },
      recommendations,
    });
  } catch (error) {
    console.error("Error generating business insights:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getDashboardOverview,
  getMonthlySales,
  getRecentOrders,
  getTopSellingBooks,
  getUsers,
  exportReport,
  getBusinessInsights,
};
