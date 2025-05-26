const Order = require("./order.model");
const {
  createNotification,
} = require("../notifications/notification.controller");

const createAOrder = async (req, res) => {
  try {
    console.log("Creating order with data:", req.body);
    console.log("User from request:", req.user);

    const requiredFields = [
      "name",
      "email",
      "address",
      "phone",
      "productIds",
      "totalPrice",
      "paymentMethod",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      console.log("Missing required fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Ensure we're using the correct user ID from the authenticated user
    const orderData = {
      ...req.body,
      user: req.user.id, // Use the MongoDB ID from the JWT token
    };

    console.log("Creating order with user ID:", orderData.user);
    const order = await Order.create(orderData);
    console.log("Order created successfully:", {
      orderId: order._id,
      userId: order.user,
      status: order.status,
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
};

const getOrderByEmail = async (req, res) => {
  try {
    console.log("Getting orders for user:", {
      id: req.user.id,
      email: req.user.email,
    });

    const orders = await Order.find({
      $or: [{ user: req.user.id }, { "user.firebaseId": req.user.firebaseId }],
    })
      .populate("productIds.productId")
      .populate("paymentMethod")
      .populate({
        path: "user",
        select: "_id firebaseId email",
      })
      .lean();

    // Simplified logging
    console.log(
      "Found orders:",
      orders.map((order) => ({
        orderId: order._id,
        userEmail: order.user?.email,
        status: order.status,
        products: order.productIds?.map(
          (item) => item.productId?.title || "Unknown Product"
        ),
      }))
    );

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error getting orders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error getting orders",
      error: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    console.log("Admin updating order:", {
      orderId: id,
      newStatus: status,
      adminId: req.user?.id,
    });

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { status } },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate({
        path: "user",
        select: "_id firebaseId email",
      })
      .populate("productIds.productId")
      .populate("paymentMethod");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Simplified logging
    console.log("Order updated:", {
      orderId: order._id,
      userEmail: order.user?.email,
      oldStatus: order.status,
      newStatus: status,
      products: order.productIds?.map(
        (item) => item.productId?.title || "Unknown Product"
      ),
    });

    if (order.user) {
      const notificationUserId = order.user.firebaseId;
      console.log("Creating notification for user:", notificationUserId);

      const notification = await createNotification(
        notificationUserId,
        `Đơn hàng #${order._id} đã được cập nhật: ${status}`,
        "order",
        { orderId: order._id, status }
      );

      // Simplified notification logging
      console.log("Notification sent:", {
        notificationId: notification._id,
        userId: notification.userId,
        message: notification.message,
      });

      const io = req.app.get("io");
      if (io && notificationUserId) {
        io.to(notificationUserId).emit("orderStatusUpdate", {
          notificationId: notification._id,
          message: `Đơn hàng #${order._id} đã được cập nhật: ${status}`,
          orderId: order._id,
          status,
          userId: notificationUserId,
          createdAt: notification.createdAt,
        });
      }
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ message: "Error updating order status" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    console.log("Getting all orders");
    const orders = await Order.find()
      .populate("productIds.productId")
      .populate("paymentMethod")
      .lean();
    console.log("Found orders:", orders);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error getting all orders:", error);
    res.status(500).json({
      success: false,
      message: "Error getting all orders",
      error: error.message,
    });
  }
};

const getOrdersByUserId = async (req, res) => {
  try {
    console.log("Getting orders for user ID:", req.params.userId);
    const orders = await Order.find({ user: req.params.userId })
      .populate("productIds.productId")
      .populate("paymentMethod")
      .lean();
    console.log("Found orders:", orders);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({
      success: false,
      message: "Error getting orders",
      error: error.message,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOrder = await Order.findByIdAndDelete(id);
    if (!deleteOrder) {
      res.status(404).send({ message: "Order is not found" });
    }
    res.status(200).send({
      message: "Order deleted successfully",
      order: deleteOrder,
    });
  } catch (error) {
    console.log("Error deleting order:", error);
    res.status(500).send({ message: "Failed to delete order" });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Getting order details:", {
      orderId: id,
      requestUser: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    });

    const order = await Order.findById(id)
      .populate("productIds.productId")
      .populate("paymentMethod")
      .populate({
        path: "user",
        select: "_id firebaseId email",
      });

    if (!order) {
      console.log("Order not found:", id);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Simplified logging
    console.log("Found order:", {
      orderId: order._id,
      userEmail: order.user?.email,
      status: order.status,
      products: order.productIds?.map(
        (item) => item.productId?.title || "Unknown Product"
      ),
    });

    const isAdmin = req.user.role === "admin";
    const isOrderOwner =
      order.user &&
      (order.user._id.toString() === req.user.id ||
        order.user.firebaseId === req.user.firebaseId ||
        order.user.email === req.user.email);

    // Simplified authorization logging
    console.log("Access check:", {
      isAdmin,
      isOrderOwner,
      requestUserEmail: req.user.email,
      orderUserEmail: order.user?.email,
    });

    if (!isAdmin && !isOrderOwner) {
      const errorMessage =
        order.user?.email === "adm@gmail.com"
          ? "Không thể xem đơn hàng của quản trị viên"
          : "Bạn không có quyền xem đơn hàng này";
      return res.status(403).json({
        success: false,
        message: errorMessage,
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error getting order details:", error.message);
    res.status(500).json({
      success: false,
      message: "Error getting order details",
      error: error.message,
    });
  }
};

module.exports = {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders,
  getOrdersByUserId,
  deleteOrder,
  getOrderById,
};
