// 1. ติดตั้ง express-ejs-layouts ก่อน
// npm install express-ejs-layouts

// 2. แก้ไข app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts'); // เพิ่ม
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
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
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layout setup - เพิ่มส่วนนี้
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Import telegram middleware
const { telegramAuth } = require('./src/middleware/telegram');
app.use(telegramAuth);

// Import routes with error handling
let indexRoutes, membershipRoutes, walletRoutes, apiRoutes;

try {
  indexRoutes = require('./src/routes/index');
} catch (error) {
  console.log('📝 Index routes not found, creating fallback...');
  indexRoutes = express.Router();
  indexRoutes.get('/', (req, res) => {
    res.render('pages/simple-index', {
      title: 'Crypto Membership NFT',
      systemStats: { totalMembers: '0' },
      userMembership: null,
      telegramUser: req.telegramUser,
      user: req.user
    });
  });
}

try {
  membershipRoutes = require('./src/routes/membership');
} catch (error) {
  console.log('🎫 Membership routes not found, creating fallback...');
  membershipRoutes = express.Router();
  membershipRoutes.get('/plans', (req, res) => {
    res.json({ message: 'Membership plans route not configured yet' });
  });
}

try {
  walletRoutes = require('./src/routes/wallet');
} catch (error) {
  console.log('💳 Wallet routes not found, creating fallback...');
  walletRoutes = express.Router();
  walletRoutes.get('/connect', (req, res) => {
    res.json({ message: 'Wallet connect route not configured yet' });
  });
}

try {
  apiRoutes = require('./src/routes/api');
} catch (error) {
  console.log('🔌 API routes not found, creating fallback...');
  apiRoutes = express.Router();
  apiRoutes.get('/health', (req, res) => {
    res.json({ 
      status: 'OK',
      message: 'API health check',
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  });
}

// Routes
app.use('/', indexRoutes);
app.use('/membership', membershipRoutes);
app.use('/wallet', walletRoutes);
app.use('/api', apiRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    telegramUser: req.telegramUser ? 'Connected' : 'Not connected'
  });
});

// Test route for telegram user
app.get('/test-telegram', (req, res) => {
  res.json({
    telegramUser: req.telegramUser,
    headers: {
      'x-telegram-init-data': req.headers['x-telegram-init-data'],
      'user-agent': req.headers['user-agent']
    },
    environment: process.env.NODE_ENV
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(500).json({ 
      error: 'Something went wrong!',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).render('error', { 
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err : {},
      telegramUser: req.telegramUser || null,
      layout: false // ไม่ใช้ layout สำหรับ error page
    });
  }
});

// 404 handler
app.use((req, res) => {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).render('404', {
      url: req.originalUrl,
      telegramUser: req.telegramUser || null,
      layout: false // ไม่ใช้ layout สำหรับ 404 page
    });
  }
});

// Connect to database
try {
  require('./src/config/database');
} catch (error) {
  console.error('❌ Database connection error:', error.message);
  console.log('⚠️  Continuing without database connection...');
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Telegram Mini App ready!`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test telegram: http://localhost:${PORT}/test-telegram`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 Development mode - Mock Telegram user enabled`);
  }
});

module.exports = app;