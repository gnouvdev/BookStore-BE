const paymentRoutes = require("./payments/payment.route");
const seedPaymentMethods = require("./payments/payment.seed");

// Routes
app.use("/api/books", bookRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/recommendations", recommendationRoutes);

// Seed data
seedPaymentMethods(); 