const express = require('express');
const cors = require('cors');
const responseHandler = require('./middleware/responseHandler');
const paymentRoutes = require('./payment/payment.routes');
const bookRoutes = require('./books/book.route');
const orderRoutes = require('./orders/order.route');
const userRoutes = require('./users/user.route');
const adminRoutes = require('./stats/admin.stats');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://book-app-frontend-tau.vercel.app'],
    credentials: true
}));
app.use(express.json());
app.use(responseHandler);

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`, req.body);
    next();
});

// API routes
app.use('/api/payment', paymentRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.url} not found`
    });
});

module.exports = app;