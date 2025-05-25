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
    console.log("Getting orders for email:", req.params.email);
    const orders = await Order.find({ email: req.params.email })
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

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    console.log("Admin updating order:", id);
    console.log("Admin user ID:", req.user?.id);

    const order = await Order.findById(id)
      .populate({
        path: "user",
        select: "_id firebaseId email",
      })
      .populate("productIds.productId")
      .populate("paymentMethod");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Order details:", {
      orderId: order._id,
      orderUser: {
        _id: order.user?._id,
        firebaseId: order.user?.firebaseId,
        email: order.user?.email,
      },
      orderStatus: order.status,
    });

    order.status = status;
    await order.save();

    if (order.user) {
      // Use Firebase ID for notification
      const notificationUserId = order.user.firebaseId;
      console.log("Creating notification for user:", notificationUserId);

      const notification = await createNotification(
        notificationUserId,
        `Đơn hàng #${order._id} đã được cập nhật: ${status}`,
        "order",
        { orderId: order._id, status }
      );

      console.log("Notification created:", {
        notificationId: notification._id,
        userId: notification.userId,
        message: notification.message,
      });

      // Get socket instance
      const io = req.app.get("io");
      if (io) {
        console.log("Socket user ID for notification:", notificationUserId);

        if (notificationUserId) {
          // Emit to specific user's room
          io.to(notificationUserId).emit("orderStatusUpdate", {
            notificationId: notification._id,
            message: `Đơn hàng #${order._id} đã được cập nhật: ${status}`,
            orderId: order._id,
            status,
            userId: notificationUserId,
            createdAt: notification.createdAt,
          });
          console.log(`Socket notification sent to user ${notificationUserId}`);

          // Also emit to all connected clients for debugging
          io.emit("debug", {
            type: "orderStatusUpdate",
            message: `Order ${order._id} status updated to ${status}`,
            userId: notificationUserId,
            timestamp: new Date(),
          });
        } else {
          console.log(
            "No Firebase ID found for user, skipping socket notification"
          );
        }
      } else {
        console.log("Socket.io instance not found");
      }
    } else {
      console.log("No user associated with order:", order._id);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error updating order status:", error);
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
    console.log("Getting order details for ID:", id);
    console.log("User requesting order:", req.user);

    const order = await Order.findById(id)
      .populate("productIds.productId")
      .populate("paymentMethod")
      .populate({
        path: "user",
        select: "_id firebaseId email",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if the user is authorized to view this order
    // Allow access if user is admin or if the order belongs to the user
    const isAdmin = req.user.role === "admin";
    const isOrderOwner =
      order.user &&
      (order.user._id.toString() === req.user.id ||
        order.user.firebaseId === req.user.firebaseId);

    console.log("Authorization check:", {
      isAdmin,
      isOrderOwner,
      orderUserId: order.user?._id?.toString(),
      requestUserId: req.user.id,
      orderUserFirebaseId: order.user?.firebaseId,
      requestUserFirebaseId: req.user.firebaseId,
    });

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    console.log("Found order:", {
      orderId: order._id,
      userId: order.user?._id?.toString(),
      status: order.status,
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error getting order details:", error);
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
