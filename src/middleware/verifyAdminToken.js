const admin = require("../authention/firebaseAdmin");
const jwt = require("jsonwebtoken");
const User = require("../users/user.model");

const verifyAdminToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Truy cập bị từ chối. Không có token được cung cấp" });
  }

  console.log("Token nhận được:", token);

  try {
    let userData;

    // Thử xác minh JWT token trước
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY, {
        algorithms: ["HS256"],
      });
      console.log("JWT Token được giải mã:", decodedToken);
      userData = {
        id: decodedToken.id,
        email: decodedToken.email,
        role: decodedToken.role,
      };
    } catch (jwtError) {
      console.log("Không phải JWT token, thử Firebase:", jwtError.message);
      // Nếu xác minh JWT thất bại, thử Firebase
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        console.log("Firebase Token được giải mã:", decodedToken);
        userData = {
          id: decodedToken.uid,
          email: decodedToken.email,
        };
      } catch (firebaseError) {
        console.error("Lỗi xác minh Firebase token:", firebaseError);
        return res.status(403).json({ message: "Token không hợp lệ" });
      }
    }

    // Kiểm tra role admin trong database
    const user = await User.findOne({
      $or: [{ _id: userData.id }, { firebaseId: userData.id }],
    });

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền truy cập admin" });
    }

    // Cập nhật userData với thông tin từ database
    userData.role = user.role;
    userData.id = user._id;
    req.user = userData;

    return next();
  } catch (error) {
    console.error("Lỗi xác minh token:", error);
    return res
      .status(403)
      .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

module.exports = verifyAdminToken;
