const paymentRoutes = require("./payments/payment.route");
const seedPaymentMethods = require("./payments/payment.seed");
const reviewRoutes = require("./reviews/review.route");

// Routes
app.use("/api/books", bookRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/reviews", reviewRoutes);

// Seed data
seedPaymentMethods();
