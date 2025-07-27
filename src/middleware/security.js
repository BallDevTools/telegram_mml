// src/middleware/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting for sensitive endpoints
const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 account creation requests per window
    message: 'Too many accounts created from this IP, please try again after an hour.'
});

const transactionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 transaction requests per window
    message: 'Too many transaction requests, please try again later.'
});

// Security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://telegram.org",
                "https://cdn.ethers.io",
                "https://*.binance.org"
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'", 
                "https://*.binance.org",
                "wss://*.binance.org",
                "https://*.infura.io",
                "https://*.alchemy.com"
            ],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
});

// Telegram data validation
const validateTelegramData = (req, res, next) => {
    try {
        const initData = req.headers['x-telegram-init-data'];
        if (!initData) {
            req.telegramUser = null;
            return next();
        }

        // Parse and validate Telegram init data
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        
        if (!hash) {
            req.telegramUser = null;
            return next();
        }

        // Create data check string
        urlParams.delete('hash');
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Verify hash
        const crypto = require('crypto');
        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(process.env.TELEGRAM_BOT_TOKEN)
            .digest();
        
        const calculatedHash = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (calculatedHash === hash) {
            const authDate = parseInt(urlParams.get('auth_date'));
            const currentTime = Math.floor(Date.now() / 1000);
            
            // Check if data is not older than 24 hours
            if (currentTime - authDate < 86400) {
                const userParam = urlParams.get('user');
                if (userParam) {
                    req.telegramUser = JSON.parse(userParam);
                }
            }
        }
        
        next();
    } catch (error) {
        console.error('Telegram validation error:', error);
        req.telegramUser = null;
        next();
    }
};

// Input sanitization
const sanitizeInput = (req, res, next) => {
    const validator = require('validator');
    
    // Sanitize common fields
    if (req.body.walletAddress) {
        req.body.walletAddress = validator.escape(req.body.walletAddress.toLowerCase());
        
        // Validate Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(req.body.walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address format' });
        }
    }
    
    if (req.body.transactionHash) {
        req.body.transactionHash = validator.escape(req.body.transactionHash);
        
        // Validate transaction hash format
        if (!/^0x[a-fA-F0-9]{64}$/.test(req.body.transactionHash)) {
            return res.status(400).json({ error: 'Invalid transaction hash format' });
        }
    }
    
    if (req.body.planId) {
        req.body.planId = parseInt(req.body.planId);
        
        // Validate plan ID range
        if (req.body.planId < 1 || req.body.planId > 16) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }
    }
    
    next();
};

module.exports = {
    createAccountLimiter,
    transactionLimiter,
    securityHeaders,
    validateTelegramData,
    sanitizeInput
};