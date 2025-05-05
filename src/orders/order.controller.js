const Order = require("./order.model");

const createAOrder = async (req, res) => {
  try {
    const newOrder = await Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(200).json(savedOrder);
  } catch (error) {
    console.error("Error creating order", error);
    res.status(500).json({ message: "Failed to create order" });
  }
};

const getOrderByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ email }).sort({ createdAt: -1 });
    console.log("Email:", req.params.email);
    console.log("Orders:", orders);
    if (!orders) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders", error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID đơn hàng từ URL
    const { status } = req.body; // Lấy trạng thái mới từ body

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true } // Trả về document đã cập nhật
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("productIds"); // Lấy thông tin chi tiết sản phẩm
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching all orders", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

module.exports = {
  createAOrder,
  getOrderByEmail,
  updateOrderStatus,
  getAllOrders, // Export hàm mới
};
