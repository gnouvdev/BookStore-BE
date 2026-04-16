const jwt = require("jsonwebtoken");
const User = require("../users/user.model");
const admin = require("../authention/firebaseAdmin");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "No token provided or invalid format" });
  }

  const token = authHeader.split(" ")[1];
  if (!token || token.trim() === "") {
    return res.status(401).json({ message: "Token missing or empty" });
  }

  try {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const user = await User.findOne({
        $or: [{ firebaseId: decodedToken.uid }, { email: decodedToken.email }],
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = {
        id: user._id,
        firebaseId: user.firebaseId,
        email: user.email,
        role: user.role,
      };

      return next();
    } catch (firebaseError) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
        algorithms: ["HS256"],
      });

      if (!decoded.id) {
        return res
          .status(401)
          .json({ message: "Invalid token: Missing user ID" });
      }

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = {
        id: user._id,
        firebaseId: user.firebaseId,
        email: user.email,
        role: user.role,
      };

      return next();
    }
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        expiredAt: error.expiredAt,
      });
    }

    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        message: "Firebase token expired",
        expiredAt: error.expiredAt,
      });
    }

    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

module.exports = verifyToken;
