const Order = require("./order.model");
const { createNotification } = require("../notifications/notification.controller");
const {
  calculateOrderTotals,
  normalizeAddress,
  releaseInventory,
  reserveInventory,
  validateCheckoutPayload,
} = require("./order.service");

const createAOrder = async (req, res) => {
  try {
    validateCheckoutPayload(req.body);

    const { paymentMethod, normalizedItems, subtotal } = await calculateOrderTotals(
      req.body.productIds,
      req.body.paymentMethod
    );

    await reserveInventory(normalizedItems);

    const order = await Order.create({
      user: req.user.id,
      name: req.body.name,
      email: req.body.email,
      address: normalizeAddress(req.body.address),
      phone: req.body.phone,
      productIds: normalizedItems,
      totalPrice: subtotal,
      paymentMethod: paymentMethod._id,
      status: "pending",
      paymentStatus: "pending",
      inventoryReserved: true,
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error creating order:", error.message);
    res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
};

const getOrderByEmail = async (req, res) => {
  try {
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

    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (
      status === "cancelled" &&
      existingOrder.inventoryReserved &&
      existingOrder.status !== "cancelled"
    ) {
      await releaseInventory(existingOrder.productIds);
    }

    const order = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          inventoryReserved:
            status === "cancelled" ? false : existingOrder.inventoryReserved,
        },
      },
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

    if (order?.user?.firebaseId) {
      const notification = await createNotification(
        order.user.firebaseId,
        `Don hang #${order._id} da duoc cap nhat: ${status}`,
        "order",
        { orderId: order._id, status }
      );

      const io = req.app.get("io");
      if (io) {
        io.to(order.user.firebaseId).emit("orderStatusUpdate", {
          notificationId: notification._id,
          message: `Don hang #${order._id} da duoc cap nhat: ${status}`,
          orderId: order._id,
          status,
          userId: order.user.firebaseId,
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
    const orders = await Order.find()
      .populate("productIds.productId")
      .populate("paymentMethod")
      .lean();

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
    const orders = await Order.find({ user: req.params.userId })
      .populate("productIds.productId")
      .populate("paymentMethod")
      .lean();

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
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).send({ message: "Order is not found" });
    }

    if (deletedOrder.inventoryReserved) {
      await releaseInventory(deletedOrder.productIds);
    }

    res.status(200).send({
      message: "Order deleted successfully",
      order: deletedOrder,
    });
  } catch (error) {
    console.log("Error deleting order:", error);
    res.status(500).send({ message: "Failed to delete order" });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

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

    const isAdmin = req.user.role === "admin";
    const isOrderOwner =
      order.user &&
      (order.user._id.toString() === req.user.id ||
        order.user.firebaseId === req.user.firebaseId ||
        order.user.email === req.user.email);

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen xem don hang nay",
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

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate({
        path: "user",
        select: "_id firebaseId email",
      })
      .populate("productIds.productId")
      .populate("paymentMethod");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOrderOwner =
      order.user &&
      (order.user._id.toString() === req.user.id ||
        order.user.firebaseId === req.user.firebaseId ||
        order.user.email === req.user.email);

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen huy don hang nay",
      });
    }

    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Khong the huy don hang o trang thai \"${order.status}\".`,
      });
    }

    if (order.inventoryReserved) {
      await releaseInventory(order.productIds);
      order.inventoryReserved = false;
    }

    order.status = "cancelled";
    if (order.paymentStatus === "pending") {
      order.paymentStatus = "failed";
    }
    await order.save();

    if (order.user?.firebaseId) {
      const notification = await createNotification(
        order.user.firebaseId,
        `Don hang #${order._id} da duoc huy`,
        "order",
        { orderId: order._id, status: "cancelled" }
      );

      const io = req.app.get("io");
      if (io) {
        io.to(order.user.firebaseId).emit("orderStatusUpdate", {
          notificationId: notification._id,
          message: `Don hang #${order._id} da duoc huy`,
          orderId: order._id,
          status: "cancelled",
          userId: order.user.firebaseId,
          createdAt: notification.createdAt,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Don hang da duoc huy thanh cong",
      data: order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error.message);
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
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
  cancelOrder,
};
