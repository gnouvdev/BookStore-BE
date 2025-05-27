const jwt = require("jsonwebtoken");
const User = require("../users/user.model");
const admin = require("../authention/firebaseAdmin");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(
    "Auth header received:",
    authHeader ? authHeader.substring(0, 20) + "..." : "Missing"
  );

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
    // Try to verify as Firebase token first
    try {
      console.log("Attempting to verify as Firebase token");
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log("Firebase token decoded:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      });

      // Find user by firebaseId or email
      const user = await User.findOne({
        $or: [{ firebaseId: decodedToken.uid }, { email: decodedToken.email }],
      });

      if (!user) {
        console.log("User not found in database for Firebase token");
        return res.status(401).json({ message: "User not found" });
      }

      // Set user data in request
      req.user = {
        id: user._id,
        firebaseId: user.firebaseId,
        email: user.email,
        role: user.role,
      };

      console.log("req.user set from Firebase token:", req.user);
      return next();
    } catch (firebaseError) {
      console.log("Not a Firebase token, trying JWT:", firebaseError.message);

      // Try JWT verification
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
          algorithms: ["HS256"],
        });
        console.log("JWT token decoded:", {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        });

        if (!decoded.id) {
          console.log("JWT token missing id field");
          return res
            .status(401)
            .json({ message: "Invalid token: Missing user ID" });
        }

        // Get user from database
        const user = await User.findById(decoded.id);
        if (!user) {
          console.log("User not found in database for JWT token");
          return res.status(401).json({ message: "User not found" });
        }

        // Set user data in request
        req.user = {
          id: user._id,
          firebaseId: user.firebaseId,
          email: user.email,
          role: user.role,
        };

        console.log("req.user set from JWT token:", req.user);
        return next();
      } catch (jwtError) {
        console.error("JWT verification failed:", jwtError);
        throw jwtError; // Re-throw to be caught by outer catch
      }
    }
  } catch (error) {
    console.error("Token verification error:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });

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
      error: error.message,
    });
  }
};

module.exports = verifyToken;
