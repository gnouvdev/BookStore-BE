const Voucher = require("./voucher.model");

const validateVoucher = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: "Voucher code and order amount are required",
      });
    }

    const voucher = await Voucher.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired voucher code",
      });
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Voucher usage limit exceeded",
      });
    }

    if (orderAmount < voucher.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ${voucher.minOrderValue.toLocaleString(
          "vi-VN"
        )}đ required`,
      });
    }

    let discount = 0;
    if (voucher.type === "percentage") {
      discount = (orderAmount * voucher.value) / 100;
      if (voucher.maxDiscount) {
        discount = Math.min(discount, voucher.maxDiscount);
      }
    } else {
      discount = voucher.value;
    }

    res.status(200).json({
      success: true,
      data: {
        voucher: {
          code: voucher.code,
          type: voucher.type,
          value: voucher.value,
          description: voucher.description,
        },
        discount: Math.round(discount),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const applyVoucher = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: "Voucher code and order amount are required",
      });
    }

    const voucher = await Voucher.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired voucher code",
      });
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Voucher usage limit exceeded",
      });
    }

    if (orderAmount < voucher.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ${voucher.minOrderValue.toLocaleString(
          "vi-VN"
        )}đ required`,
      });
    }

    let discount = 0;
    if (voucher.type === "percentage") {
      discount = (orderAmount * voucher.value) / 100;
      if (voucher.maxDiscount) {
        discount = Math.min(discount, voucher.maxDiscount);
      }
    } else {
      discount = voucher.value;
    }

    // Increment used count
    voucher.usedCount += 1;
    await voucher.save();

    res.status(200).json({
      success: true,
      data: {
        voucher: {
          code: voucher.code,
          type: voucher.type,
          value: voucher.value,
          description: voucher.description,
        },
        discount: Math.round(discount),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createVoucher = async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      description,
    } = req.body;

    // Validate required fields
    if (!code || !type || !value || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Validate value based on type
    if (type === "percentage" && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage value must be between 0 and 100",
      });
    }
    if (type === "fixed" && value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed value must be greater than 0",
      });
    }

    // Check if voucher code already exists
    const existingVoucher = await Voucher.findOne({ code: code.toUpperCase() });
    if (existingVoucher) {
      return res.status(400).json({
        success: false,
        message: "Voucher code already exists",
      });
    }

    // Create new voucher
    const voucher = await Voucher.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxDiscount: maxDiscount || null,
      startDate: start,
      endDate: end,
      usageLimit: usageLimit || null,
      description: description || "",
    });

    res.status(201).json({
      success: true,
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find();
    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const { voucherId } = req.params;
    const { code, type, value, minOrderValue, maxDiscount, startDate, endDate, usageLimit, description } = req.body;  

    const voucher = await Voucher.findByIdAndUpdate(voucherId, {
      code,
      type,
      value,
      minOrderValue,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      description,
    });

    res.status(200).json({
      success: true,
      message: "Voucher updated successfully",
      data: voucher,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const deleteVoucher = async (req, res) => {
  try {
    const { voucherId } = req.params;
    await Voucher.findByIdAndDelete(voucherId);
    res.status(200).json({
      success: true,
      message: "Voucher deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  validateVoucher,
  applyVoucher,
  createVoucher,
  getAllVouchers,
  updateVoucher,
  deleteVoucher,
};
