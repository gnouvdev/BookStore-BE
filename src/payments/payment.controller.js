const Payment = require("./payment.model");

// Lấy danh sách phương thức thanh toán
const getPaymentMethods = async (req, res) => {
  try {
    const payments = await Payment.find({ isActive: true });
    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment methods",
      error: error.message
    });
  }
};

// Thêm phương thức thanh toán mới (Admin only)
const addPaymentMethod = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const payment = await Payment.create({
      name,
      description,
      icon
    });
    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding payment method",
      error: error.message
    });
  }
};

// Cập nhật phương thức thanh toán (Admin only)
const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, isActive } = req.body;
    
    const payment = await Payment.findByIdAndUpdate(
      id,
      { name, description, icon, isActive },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found"
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating payment method",
      error: error.message
    });
  }
};

// Xóa phương thức thanh toán (Admin only)
const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment method deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting payment method",
      error: error.message
    });
  }
};

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod
}; 