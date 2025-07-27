// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const indexRoutes = require('./src/routes/index');
const membershipRoutes = require('./src/routes/membership');
const walletRoutes = require('./src/routes/wallet');
const apiRoutes = require('./src/routes/api');

// Import middleware
const telegramAuth = require('./src/middleware/telegram');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // สำหรับ Web3 และ Telegram
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Basic middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'crypto-membership-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Telegram middleware
app.use(telegramAuth);

// Routes
app.use('/', indexRoutes);
app.use('/membership', membershipRoutes);
app.use('/wallet', walletRoutes);
app.use('/api', apiRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    message: 'Something went wrong!',
    telegramUser: req.telegramUser
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    telegramUser: req.telegramUser
  });
});

// Connect to database
require('./src/config/database');

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Telegram Mini App ready!`);
});

module.exports = app;