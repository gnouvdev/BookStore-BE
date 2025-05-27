const admin = require("firebase-admin");

// Khởi tạo Firebase Admin SDK nếu chưa được khởi tạo
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    // Validate required fields
    if (
      !serviceAccount.projectId ||
      !serviceAccount.privateKey ||
      !serviceAccount.clientEmail
    ) {
      throw new Error("Missing required Firebase credentials");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    throw error;
  }
}

// Sử dụng một secret key cố định cho JWT
const JWT_SECRET_KEY = "your_super_secret_key_123";
const JWT_EXPIRES_IN = "7d";

// Export các biến môi trường
process.env.JWT_SECRET_KEY = JWT_SECRET_KEY;
process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;

module.exports = admin;
