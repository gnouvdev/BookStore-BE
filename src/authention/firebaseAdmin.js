const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Sử dụng một secret key cố định cho JWT
const JWT_SECRET_KEY = "your_super_secret_key_123";
const JWT_EXPIRES_IN = "7d";

// Export các biến môi trường
process.env.JWT_SECRET_KEY = JWT_SECRET_KEY;
process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;

module.exports = admin;
