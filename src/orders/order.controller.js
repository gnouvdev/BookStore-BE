const Order = require("./order.model");

const createAOrder = async (req, res) => {
  try {
    console.log("Creating order with data:", req.body);

    const requiredFields = [
      "user",
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

    const order = await Order.create(req.body);
    console.log("Order created successfully:", order);

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
    console.log("Updating order status:", {
      id: req.params.id,
      status: req.body.status,
    });
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    console.log("Updated order:", order);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
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

module.exports = {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders,
  getOrdersByUserId,
  deleteOrder,
};