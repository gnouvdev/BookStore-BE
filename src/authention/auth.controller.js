const jwt = require("jsonwebtoken");
const User = require("../users/user.model");
const admin = require("./firebaseAdmin");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

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
  const { fullName, email, password, phone, address } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role: "user",
      phone,
      address,
      wishlist: [],
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};
const generatePasswordResetToken = async (user) => {
  const token = await user.generatePasswordResetToken();
  return token;
};
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot password request for:", email);

    // Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_APP_PASSWORD:", process.env.EMAIL_APP_PASSWORD);
    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // Sử dụng App Password thay vì mật khẩu thường
      },
    });

    // Email content
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Your Password - BookStore",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Reset Your Password</h2>
          <p>Hello ${user.fullName || "there"},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email, please do not reply.
          </p>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to:", email);

    res.status(200).json({
      message: "Password reset instructions sent to your email",
      email: email, // Trả về email đã gửi để frontend có thể hiển thị
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    // Handle specific email errors
    if (error.code === "EAUTH") {
      return res.status(500).json({
        message: "Email service configuration error",
        error: "Could not send reset email",
      });
    }

    res.status(500).json({
      message: "Failed to process password reset",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token và mật khẩu mới là bắt buộc" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res
        .status(400)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // Tìm user theo email trong token
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Hash mật khẩu mới cho MongoDB
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Đổi mật khẩu trên Firebase
    if (user.firebaseId) {
      await admin.auth().updateUser(user.firebaseId, { password: newPassword });
    }

    res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Lỗi khi đặt lại mật khẩu" });
  }
};

module.exports = {
  login,
  register,
  forgotPassword,
  resetPassword,
};
