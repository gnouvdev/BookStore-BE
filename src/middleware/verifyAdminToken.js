const admin = require("../authention/firebaseAdmin");
const jwt = require("jsonwebtoken");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Truy cập bị từ chối. Không có token được cung cấp" });
  }

  console.log("Token nhận được:", token); // Log để kiểm tra token

  try {
    // Thử xác minh Firebase ID token
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log("Firebase Token được giải mã:", decodedToken);

      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "user",
      };
      return next();
    } catch (firebaseError) {
      console.log("Không phải Firebase token, thử JWT:", firebaseError.message);
      // Nếu xác minh Firebase thất bại, thử JWT
      try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        console.log("JWT Token được giải mã:", decodedToken);

        req.user = {
          id: decodedToken.id,
          email: decodedToken.email,
          role: decodedToken.role || "user",
        };
        return next();
      } catch (jwtError) {
        console.error("Lỗi xác minh JWT token:", jwtError);
        return res.status(403).json({ message: "Token JWT không hợp lệ" });
      }
    }
  } catch (error) {
    console.error("Lỗi xác minh token:", error);
    return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

module.exports = verifyToken;