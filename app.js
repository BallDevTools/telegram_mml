// app.js - แก้ไขการ import telegram middleware
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
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

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Import telegram middleware - แก้ไขการ import
const { telegramAuth } = require('./src/middleware/telegram');

// Apply telegram middleware
app.use(telegramAuth);

// Import routes with error handling
let indexRoutes, membershipRoutes, walletRoutes, apiRoutes;

try {
  indexRoutes = require('./src/routes/index');
} catch (error) {
  console.log('📝 Index routes not found, creating fallback...');
  indexRoutes = express.Router();
  indexRoutes.get('/', (req, res) => {
    res.json({ 
      message: 'Crypto Membership NFT',
      status: 'Homepage route not configured yet',
      telegramUser: req.telegramUser,
      timestamp: new Date().toISOString()
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
      message: 'API routes not fully configured yet',
      timestamp: new Date().toISOString()
    });
  });
}

// Routes
app.use('/', indexRoutes);
app.use('/membership', membershipRoutes);
app.use('/wallet', walletRoutes);
app.use('/api', apiRoutes);

// Main health check route
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
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
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