require("dotenv").config();

/**
 * Script tạo 2 nhóm users với số interactions khác nhau:
 * - Nhóm 1: nhiều interactions (trung bình ~50)
 * - Nhóm 2: ít interactions (trung bình ~10)
 *
 * CÁCH CHẠY:
 *   node backend/src/utils/seedMixedUsers.js
 */

const { execSync } = require("child_process");
const path = require("path");

async function main() {
  console.log("=" * 60);
  console.log("Tạo 2 nhóm users với số interactions khác nhau");
  console.log("=" * 60);

  // Nhóm 1: 100 users với trung bình ~50 interactions
  console.log(
    "\n📊 Nhóm 1: Tạo 100 users với trung bình ~50 interactions/user"
  );
  console.log("   (target: 100-120 interactions để đạt ~50 thực tế)\n");
  execSync(`node ${path.join(__dirname, "seedNewUsers.js")} 100 100 120`, {
    stdio: "inherit",
    cwd: path.join(__dirname, "../.."),
  });

  // Nhóm 2: 100 users với trung bình ~10 interactions
  console.log(
    "\n📊 Nhóm 2: Tạo 100 users với trung bình ~10 interactions/user"
  );
  console.log("   (target: 20-30 interactions để đạt ~10 thực tế)\n");
  execSync(`node ${path.join(__dirname, "seedNewUsers.js")} 100 20 30`, {
    stdio: "inherit",
    cwd: path.join(__dirname, "../.."),
  });

  console.log("\n" + "=" * 60);
  console.log("✅ Hoàn thành! Đã tạo 200 users mới:");
  console.log("   - 100 users với ~50 interactions/user");
  console.log("   - 100 users với ~10 interactions/user");
  console.log("=" * 60);
}

main().catch(console.error);
