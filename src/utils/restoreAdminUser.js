/**
 * Script khôi phục Admin User nếu bị xóa nhầm
 *
 * Sử dụng:
 *   cd backend
 *   node src/utils/restoreAdminUser.js
 *
 * Hoặc chỉ định email và password:
 *   node src/utils/restoreAdminUser.js admin@example.com password123
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../users/user.model");

async function restoreAdminUser(email, password) {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ Thiếu biến môi trường DB_URL");
    process.exit(1);
  }

  console.log("🔄 Đang kết nối MongoDB...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB\n");

  try {
    // Kiểm tra xem admin user đã tồn tại chưa
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("✅ Admin user đã tồn tại:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Full Name: ${existingAdmin.fullName || "N/A"}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log("\n💡 Nếu bạn muốn tạo admin mới, hãy xóa admin cũ trước.");
      return;
    }

    // Lấy email và password từ command line hoặc dùng giá trị mặc định
    const adminEmail =
      email || process.env.ADMIN_EMAIL || "admin@bookstore.com";
    const adminPassword = password || process.env.ADMIN_PASSWORD || "admin123";
    const adminName = process.env.ADMIN_NAME || "Admin User";

    // Kiểm tra xem email đã được sử dụng chưa (bởi user thường)
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log("✅ User này đã là admin:");
        console.log(`   Email: ${existingUser.email}`);
        return;
      } else {
        // Nâng cấp user thường thành admin
        existingUser.role = "admin";
        if (adminPassword) {
          existingUser.password = adminPassword; // Sẽ được hash tự động
        }
        await existingUser.save();
        console.log("✅ Đã nâng cấp user thành admin:");
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   Full Name: ${existingUser.fullName || adminName}`);
        console.log(`   Role: ${existingUser.role}`);
        return;
      }
    }

    // Tạo admin user mới
    const timestamp = Date.now();
    const adminUser = new User({
      firebaseId: `admin_${timestamp}`,
      email: adminEmail,
      password: adminPassword, // Sẽ được hash tự động bởi pre-save hook
      fullName: adminName,
      role: "admin",
      phone: "0900000000",
    });

    await adminUser.save();

    console.log("✅ Đã tạo Admin User mới:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Full Name: ${adminName}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log("\n💡 Hãy đổi password sau khi đăng nhập!");
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

// Lấy arguments từ command line
const args = process.argv.slice(2);
const email = args[0] || null;
const password = args[1] || null;

restoreAdminUser(email, password).catch(console.error);
