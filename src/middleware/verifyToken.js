const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Xác thực token với thuật toán HS256
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Token expired",
        expiredAt: error.expiredAt
      });
    }
    
    return res.status(401).json({ 
      message: "Invalid token",
      error: error.message 
    });
  }
};

module.exports = verifyToken;