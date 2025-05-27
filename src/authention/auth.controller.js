const jwt = require("jsonwebtoken");
const User = require("../users/user.model");
const admin = require("./firebaseAdmin");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: "7d",
    }
  );
};

const login = async (req, res) => {
  try {
    const { idToken, email, uid, displayName, photoURL } = req.body;
    console.log("Login attempt:", { email, uid });

    if (!idToken || !email || !uid) {
      console.log("Missing required fields:", {
        idToken: !!idToken,
        email: !!email,
        uid: !!uid,
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify Firebase token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log("Firebase token verified:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      });

      if (decodedToken.uid !== uid) {
        console.log("Token UID mismatch:", {
          tokenUid: decodedToken.uid,
          providedUid: uid,
        });
        return res.status(401).json({ message: "Invalid token" });
      }
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return res.status(401).json({ message: "Invalid Firebase token" });
    }

    // Find or create user
    let user = await User.findOne({ email });
    console.log("User lookup result:", user ? "Found" : "Not found");

    if (!user) {
      console.log("Creating new user");
      user = await User.create({
        email,
        firebaseId: uid,
        fullName: displayName || email.split("@")[0],
        avatar: photoURL,
        role: "user",
      });
      console.log("New user created:", { id: user._id, email: user.email });
    } else if (user.firebaseId !== uid) {
      console.log("Updating user's Firebase ID");
      user.firebaseId = uid;
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);
    console.log("JWT token generated for user:", {
      id: user._id,
      email: user.email,
    });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { idToken, email, fullName } = req.body;
    console.log("Register attempt:", { email, fullName });

    if (!idToken || !email) {
      console.log("Missing required fields:", {
        idToken: !!idToken,
        email: !!email,
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify Firebase token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log("Firebase token verified:", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      });

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: decodedToken.email }, { firebaseId: decodedToken.uid }],
      });

      if (existingUser) {
        console.log("User already exists:", {
          id: existingUser._id,
          email: existingUser.email,
          firebaseId: existingUser.firebaseId,
        });
        return res.status(400).json({ message: "User already exists" });
      }

      // Create new user
      const user = await User.create({
        email: decodedToken.email,
        firebaseId: decodedToken.uid,
        fullName: fullName || decodedToken.email.split("@")[0],
        role: "user",
      });

      console.log("New user created:", { id: user._id, email: user.email });

      // Generate JWT token
      const token = generateToken(user);
      console.log("JWT token generated for new user");

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return res.status(401).json({ message: "Invalid Firebase token" });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
};

module.exports = {
  login,
  register,
};
