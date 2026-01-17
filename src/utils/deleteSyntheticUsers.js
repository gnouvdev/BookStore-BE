require("dotenv").config();

/**
 * Script xóa users synthetic (có email/username chứa "synthetic")
 *
 * CẢNH BÁO: Script này sẽ XÓA VĨNH VIỄN users và tất cả interactions liên quan!
 * Chỉ dùng khi chắc chắn muốn xóa.
 *
 * CÁCH CHẠY:
 *   node backend/src/utils/deleteSyntheticUsers.js
 */

const mongoose = require("mongoose");
const User = require("../users/user.model");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Review = require("../reviews/review.model");

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ Thiếu biến môi trường DB_URL");
    process.exit(1);
  }

  console.log("🔄 Đang kết nối MongoDB...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    // Tìm users synthetic
    const syntheticUsers = await User.find({
      $or: [
        { email: { $regex: /synthetic/, $options: "i" } },
        { firebaseId: { $regex: /synthetic/, $options: "i" } },
      ],
    }).select("_id email");

    console.log(`\n📊 Tìm thấy ${syntheticUsers.length} synthetic users`);

    if (syntheticUsers.length === 0) {
      console.log("✅ Không có synthetic users để xóa");
      return;
    }

    const userIds = syntheticUsers.map((u) => u._id);

    // Xóa interactions
    console.log("\n🗑️  Đang xóa interactions...");
    const viewResult = await ViewHistory.deleteMany({ user: { $in: userIds } });
    const reviewResult = await Review.deleteMany({ user: { $in: userIds } });

    // Xóa wishlist (cập nhật User model)
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { wishlist: [] } }
    );

    // Xóa users
    console.log("🗑️  Đang xóa users...");
    const userResult = await User.deleteMany({ _id: { $in: userIds } });

    console.log("\n✅ Đã xóa:");
    console.log(`  - ${userResult.deletedCount} users`);
    console.log(`  - ${viewResult.deletedCount} ViewHistory`);
    console.log(`  - ${reviewResult.deletedCount} Reviews`);

    // Kiểm tra users còn lại
    const remainingUsers = await User.countDocuments();
    console.log(`\n📊 Số users còn lại trong database: ${remainingUsers}`);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

main().catch(console.error);
