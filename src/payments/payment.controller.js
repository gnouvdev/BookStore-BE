const Payment = require("./payment.model");

// Lấy danh sách phương thức thanh toán
const getPaymentMethods = async (req, res) => {
  try {
    const { minAmount } = req.query;
    const query = { isActive: true };

    if (minAmount) {
      query.minAmount = { $lte: Number(minAmount) };
    }

    const payments = await Payment.find(query);
    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment methods",
      error: error.message,
    });
  }
};

// Thêm phương thức thanh toán mới (Admin only)
const addPaymentMethod = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      code,
      config,
      minAmount,
      maxAmount,
      processingFee,
      processingFeeType,
    } = req.body;

    // Validate required fields
    if (!name || !description || !icon || !code) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Check if code already exists
    const existingPayment = await Payment.findOne({ code });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment code already exists",
      });
    }

    const payment = await Payment.create({
      name,
      description,
      icon,
      code,
      config,
      minAmount,
      maxAmount,
      processingFee,
      processingFeeType,
    });

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding payment method",
      error: error.message,
    });
  }
};

// Cập nhật phương thức thanh toán (Admin only)
const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      icon,
      isActive,
      config,
      minAmount,
      maxAmount,
      processingFee,
      processingFeeType,
    } = req.body;

    const updateData = {
      name,
      description,
      icon,
      isActive,
      config,
      minAmount,
      maxAmount,
      processingFee,
      processingFeeType,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const payment = await Payment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating payment method",
      error: error.message,
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
        message: "Payment method not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting payment method",
      error: error.message,
    });
  }
};

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};
