const jwt = require("jsonwebtoken");
const User = require("../users/user.model");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Auth header received:", authHeader || "Missing");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Invalid or missing auth header:", authHeader);
    return res
      .status(401)
      .json({ message: "No token provided or invalid format" });
  }

  const token = authHeader.split(" ")[1];
  if (!token || token.trim() === "") {
    console.log("Token is empty or invalid");
    return res.status(401).json({ message: "Token missing or empty" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
      algorithms: ["HS256"],
    });
    console.log("Decoded token:", decoded);
    if (!decoded.id) {
      console.log("Token missing id field:", decoded);
      return res
        .status(401)
        .json({ message: "Invalid token: Missing user ID" });
    }

    // Get user from database to get firebaseId
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log("User not found in database");
      return res.status(401).json({ message: "User not found" });
    }

    // Set user data in request
    req.user = {
      id: user._id,
      firebaseId: user.firebaseId,
      email: user.email,
      role: user.role,
    };

    console.log("req.user set:", req.user);
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired", expiredAt: error.expiredAt });
    }
    return res
      .status(401)
      .json({ message: "Invalid token", error: error.message });
  }
};

module.exports = verifyToken;
