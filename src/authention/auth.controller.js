const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const User = require("../users/user.model");

// Khởi tạo Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const loginWithFirebase = async (req, res) => {
  const { idToken } = req.body;

  try {
    // Xác minh Firebase idToken
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseId = decodedToken.uid;
    const email = decodedToken.email;
    const photoURL = decodedToken.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

    // Tìm hoặc tạo user trong MongoDB
    let user = await User.findOne({ firebaseId });
    if (!user) {
      user = new User({
        firebaseId,
        email,
        photoURL,
        role: "user",
      });
      await user.save();
    }

    // Tạo JWT
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h", algorithm: "HS256" }
    );

    res.status(200).json({
      message: "Login successful",
      token: jwtToken,
      role: user.role,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        photoURL: user.photoURL,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Firebase login error:", error);
    res.status(401).json({ message: "Invalid Firebase token" });
  }
};

const googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseId = decodedToken.uid;
    const email = decodedToken.email;
    const fullName = decodedToken.name || "";
    const photoURL = decodedToken.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

    let user = await User.findOne({ firebaseId });
    if (!user) {
      user = new User({
        firebaseId,
        email,
        fullName,
        photoURL,
        role: "user",
      });
      await user.save();
    }

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d", algorithm: "HS256" }
    );

    res.status(200).json({
      message: "Google login successful",
      token: jwtToken,
      role: user.role,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        photoURL: user.photoURL,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Invalid Google token" });
  }
};

module.exports = {
  loginWithFirebase,
  googleLogin,
};