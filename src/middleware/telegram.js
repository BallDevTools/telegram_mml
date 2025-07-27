// src/middleware/telegram.js
const crypto = require('crypto');

/**
 * Telegram Web App authentication middleware
 * Validates Telegram init data and extracts user information
 */
function telegramAuth(req, res, next) {
    try {
        // Get init data from different possible sources
        const initData = req.headers['x-telegram-init-data'] || 
                        req.body.initData || 
                        req.query.initData ||
                        req.headers.authorization?.replace('tma ', '');

        if (!initData) {
            req.telegramUser = null;
            return next();
        }

        // Parse URL parameters
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        
        if (!hash) {
            req.telegramUser = null;
            return next();
        }

        // Create data check string (remove hash and sort alphabetically)
        urlParams.delete('hash');
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Verify hash using bot token
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.warn('TELEGRAM_BOT_TOKEN not set, skipping validation');
            req.telegramUser = parseUserData(urlParams);
            return next();
        }

        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(process.env.TELEGRAM_BOT_TOKEN)
            .digest();
        
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        // Verify hash matches
        if (calculatedHash === hash) {
            // Check auth date (should not be older than 24 hours)
            const authDate = parseInt(urlParams.get('auth_date'));
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (currentTime - authDate < 86400) { // 24 hours
                req.telegramUser = parseUserData(urlParams);
            } else {
                console.warn('Telegram auth data too old:', currentTime - authDate);
                req.telegramUser = null;
            }
        } else {
            console.warn('Telegram hash verification failed');
            req.telegramUser = null;
        }
        
        next();
    } catch (error) {
        console.error('Telegram auth error:', error);
        req.telegramUser = null;
        next();
    }
}

/**
 * Parse user data from URL parameters
 */
function parseUserData(urlParams) {
    try {
        const userParam = urlParams.get('user');
        if (!userParam) return null;

        const user = JSON.parse(userParam);
        
        // Add additional data if available
        const queryId = urlParams.get('query_id');
        const authDate = urlParams.get('auth_date');
        const startParam = urlParams.get('start_param');
        
        return {
            ...user,
            query_id: queryId,
            auth_date: authDate ? parseInt(authDate) : null,
            start_param: startParam,
            // Add theme parameters if available
            colorScheme: urlParams.get('color_scheme') || 'light',
            bg_color: urlParams.get('bg_color'),
            text_color: urlParams.get('text_color'),
            hint_color: urlParams.get('hint_color'),
            link_color: urlParams.get('link_color'),
            button_color: urlParams.get('button_color'),
            button_text_color: urlParams.get('button_text_color')
        };
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

/**
 * Middleware to require Telegram authentication
 */
function requireTelegramAuth(req, res, next) {
    if (!req.telegramUser) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                error: 'Telegram authentication required' 
            });
        } else {
            return res.status(401).render('error', {
                message: 'Access denied. Please open this app from Telegram.',
                telegramUser: null
            });
        }
    }
    next();
}

/**
 * Middleware to validate specific Telegram user permissions
 */
function validateTelegramUser(options = {}) {
    return (req, res, next) => {
        const { allowBots = false, requiredFields = [] } = options;
        
        if (!req.telegramUser) {
            return res.status(401).json({ error: 'Telegram authentication required' });
        }

        // Check if bots are allowed
        if (req.telegramUser.is_bot && !allowBots) {
            return res.status(403).json({ error: 'Bots are not allowed' });
        }

        // Check required fields
        for (const field of requiredFields) {
            if (!req.telegramUser[field]) {
                return res.status(400).json({ 
                    error: `Missing required field: ${field}` 
                });
            }
        }

        next();
    };
}

/**
 * Generate verification token for additional security
 */
function generateVerificationToken(telegramUser) {
    const data = {
        id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        timestamp: Date.now()
    };
    
    return crypto
        .createHmac('sha256', process.env.SESSION_SECRET || 'default-secret')
        .update(JSON.stringify(data))
        .digest('hex');
}

/**
 * Verify verification token
 */
function verifyVerificationToken(token, telegramUser) {
    try {
        const expectedToken = generateVerificationToken(telegramUser);
        return crypto.timingSafeEqual(
            Buffer.from(token, 'hex'),
            Buffer.from(expectedToken, 'hex')
        );
    } catch (error) {
        return false;
    }
}

/**
 * Middleware to handle referral codes from Telegram start parameters
 */
function handleReferralCode(req, res, next) {
    try {
        if (req.telegramUser?.start_param) {
            const startParam = req.telegramUser.start_param;
            
            if (startParam.startsWith('ref_')) {
                const referralCode = startParam.replace('ref_', '');
                req.session.referralCode = referralCode;
                req.session.hasReferral = true;
            }
        }
        
        next();
    } catch (error) {
        console.error('Referral code handling error:', error);
        next();
    }
}

/**
 * Development middleware to simulate Telegram user (for testing)
 */
function developmentTelegramUser(req, res, next) {
    if (process.env.NODE_ENV === 'development' && !req.telegramUser) {
        // Only use if no real Telegram data exists
        req.telegramUser = {
            id: 12345678,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'en',
            is_bot: false,
            query_id: 'test_query',
            auth_date: Math.floor(Date.now() / 1000),
            colorScheme: 'light'
        };
    }
    next();
}

module.exports = {
    telegramAuth,
    requireTelegramAuth,
    validateTelegramUser,
    generateVerificationToken,
    verifyVerificationToken,
    handleReferralCode,
    developmentTelegramUser
};