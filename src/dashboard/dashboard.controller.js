const Order = require("../orders/order.model");
const Book = require("../books/book.model");
const User = require("../users/user.model");
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
      { $match: { ...dateFilter, status: { $in: ["delivered", "shipped"] } } },
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
      status: "delivered",
    });

    // Giá trị đơn hàng trung bình
    const avgOrderValue = await Order.aggregate([
      { $match: { ...dateFilter, status: { $in: ["delivered", "shipped"] } } },
      { $group: { _id: null, avg: { $avg: "$totalPrice" } } },
    ]);

    res.status(200).json({
      totalBooks,
      totalSales: totalSales[0]?.total || 0,
      totalOrders,
      totalUsers,
      pendingOrders,
      completedOrders,
      averageOrderValue: avgOrderValue[0]?.avg || 0,
    });
  } catch (error) {
    console.error("Error getting dashboard overview:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy dữ liệu doanh số theo tháng
const getMonthlySales = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySales = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          createdAt: { $gte: sixMonthsAgo },
          status: { $in: ["delivered", "shipped"] },
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
          averageOrderValue: { $avg: "$totalPrice" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    const formattedSales = monthlySales.map((sale) => ({
      monthName: new Date(sale._id.year, sale._id.month - 1).toLocaleString(
        "default",
        { month: "short" }
      ),
      totalSales: sale.totalSales,
      totalOrders: sale.totalOrders,
      averageOrderValue: sale.averageOrderValue,
    }));

    res.status(200).json(formattedSales);
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
      .limit(10)
      .populate("user", "fullName photoURL")
      .select("_id user totalPrice status createdAt productIds");

    res.status(200).json(recentOrders);
  } catch (error) {
    console.error("Error getting recent orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Lấy danh sách sách bán chạy
const getTopSellingBooks = async (req, res) => {
  try {
    const dateFilter = createDateFilter(req);
    const topBooks = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$productIds" },
      {
        $group: {
          _id: "$productIds.productId",
          totalSold: { $sum: "$productIds.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: [
                "$totalPrice",
                {
                  $divide: [
                    "$productIds.quantity",
                    { $sum: "$productIds.quantity" },
                  ],
                },
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
          stock: "$bookDetails.stock",
          stockPercentage: {
            $multiply: [
              {
                $divide: [
                  "$bookDetails.stock",
                  { $add: ["$bookDetails.stock", "$totalSold"] },
                ],
              },
              100,
            ],
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json(topBooks);
  } catch (error) {
    console.error("Error getting top selling books:", error);
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
              status: { $in: ["delivered", "shipped"] },
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
          { header: "Date", key: "date", width: 15 },
          { header: "Total Sales", key: "totalSales", width: 20 },
          { header: "Order Count", key: "orderCount", width: 15 },
        ];

        // Thêm dữ liệu
        salesData.forEach((sale) => {
          worksheet.addRow({
            date: new Date(
              sale._id.year,
              sale._id.month - 1,
              sale._id.day
            ).toLocaleDateString(),
            totalSales: sale.totalSales,
            orderCount: sale.orderCount,
          });
        });
        break;
      }

      case "orders": {
        // Lấy dữ liệu đơn hàng
        const orders = await Order.find(dateFilter)
          .populate("user", "fullName email")
          .populate("productIds.productId", "title price")
          .sort({ createdAt: -1 });

        // Tạo header
        worksheet.columns = [
          { header: "Order ID", key: "orderId", width: 20 },
          { header: "Date", key: "date", width: 15 },
          { header: "Customer", key: "customer", width: 30 },
          { header: "Status", key: "status", width: 15 },
          { header: "Total Amount", key: "totalAmount", width: 20 },
          { header: "Items", key: "items", width: 40 },
        ];

        // Thêm dữ liệu
        orders.forEach((order) => {
          worksheet.addRow({
            orderId: order._id.toString(),
            date: order.createdAt.toLocaleDateString(),
            customer: `${order.user.fullName} (${order.user.email})`,
            status: order.status,
            totalAmount: order.totalPrice,
            items: order.productIds
              .map((item) => `${item.productId.title} x${item.quantity}`)
              .join(", "),
          });
        });
        break;
      }

      case "users": {
        // Lấy dữ liệu người dùng
        const users = await User.find({ role: "user" })
          .select("fullName email createdAt")
          .sort({ createdAt: -1 });

        // Tạo header
        worksheet.columns = [
          { header: "User ID", key: "userId", width: 20 },
          { header: "Name", key: "name", width: 30 },
          { header: "Email", key: "email", width: 30 },
          { header: "Join Date", key: "joinDate", width: 15 },
        ];

        // Thêm dữ liệu
        users.forEach((user) => {
          worksheet.addRow({
            userId: user._id.toString(),
            name: user.fullName,
            email: user.email,
            joinDate: user.createdAt.toLocaleDateString(),
          });
        });
        break;
      }

      default:
        return res.status(400).json({ message: "Invalid report type" });
    }

    // Thiết lập header cho response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${type}-report-${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );

    // Gửi file
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getDashboardOverview,
  getMonthlySales,
  getRecentOrders,
  getTopSellingBooks,
  exportReport,
};
