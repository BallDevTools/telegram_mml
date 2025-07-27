// src/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const { ethers } = require('ethers');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errorMessages
            });
        } else {
            // For form submissions, flash errors and redirect back
            req.session.validationErrors = errorMessages;
            return res.redirect('back');
        }
    }
    next();
};

/**
 * Custom validator for Ethereum addresses
 */
const isValidEthereumAddress = (value) => {
    return ethers.utils.isAddress(value);
};

/**
 * Custom validator for transaction hashes
 */
const isValidTransactionHash = (value) => {
    return /^0x[a-fA-F0-9]{64}$/.test(value);
};

/**
 * Custom validator for plan IDs
 */
const isValidPlanId = (value) => {
    const planId = parseInt(value);
    return Number.isInteger(planId) && planId >= 1 && planId <= 16;
};

/**
 * Custom validator for USDT amounts
 */
const isValidUSDTAmount = (value) => {
    const amount = parseFloat(value);
    return !isNaN(amount) && amount > 0 && amount <= 1000000; // Max 1M USDT
};

/**
 * Validation rules for wallet connection
 */
const validateWalletConnection = [
    body('walletAddress')
        .notEmpty()
        .withMessage('Wallet address is required')
        .custom(isValidEthereumAddress)
        .withMessage('Invalid Ethereum address format')
        .customSanitizer(value => value.toLowerCase()),
    
    body('signature')
        .optional()
        .isLength({ min: 130, max: 132 })
        .withMessage('Invalid signature format'),
    
    body('message')
        .optional()
        .isLength({ min: 10, max: 200 })
        .withMessage('Message must be between 10 and 200 characters'),
    
    handleValidationErrors
];

/**
 * Validation rules for membership registration
 */
const validateMembershipRegistration = [
    body('planId')
        .notEmpty()
        .withMessage('Plan ID is required')
        .custom(isValidPlanId)
        .withMessage('Invalid plan ID. Must be between 1 and 16'),
    
    body('walletAddress')
        .notEmpty()
        .withMessage('Wallet address is required')
        .custom(isValidEthereumAddress)
        .withMessage('Invalid Ethereum address format')
        .customSanitizer(value => value.toLowerCase()),
    
    body('transactionHash')
        .notEmpty()
        .withMessage('Transaction hash is required')
        .custom(isValidTransactionHash)
        .withMessage('Invalid transaction hash format'),
    
    body('uplineAddress')
        .optional()
        .custom((value) => {
            if (value && !isValidEthereumAddress(value)) {
                throw new Error('Invalid upline address format');
            }
            return true;
        })
        .customSanitizer(value => value ? value.toLowerCase() : undefined),
    
    handleValidationErrors
];

/**
 * Validation rules for plan upgrade
 */
const validatePlanUpgrade = [
    body('newPlanId')
        .notEmpty()
        .withMessage('New plan ID is required')
        .custom(isValidPlanId)
        .withMessage('Invalid plan ID. Must be between 1 and 16'),
    
    body('transactionHash')
        .notEmpty()
        .withMessage('Transaction hash is required')
        .custom(isValidTransactionHash)
        .withMessage('Invalid transaction hash format'),
    
    body('walletAddress')
        .optional()
        .custom(isValidEthereumAddress)
        .withMessage('Invalid wallet address format')
        .customSanitizer(value => value ? value.toLowerCase() : undefined),
    
    handleValidationErrors
];

/**
 * Validation rules for referral code
 */
const validateReferralCode = [
    param('code')
        .optional()
        .isLength({ min: 6, max: 20 })
        .withMessage('Referral code must be between 6 and 20 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Referral code can only contain letters and numbers'),
    
    handleValidationErrors
];

/**
 * Validation rules for user profile update
 */
const validateProfileUpdate = [
    body('firstName')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name must be between 1 and 50 characters')
        .trim()
        .escape(),
    
    body('lastName')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Last name must be less than 50 characters')
        .trim()
        .escape(),
    
    body('username')
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    
    handleValidationErrors
];

/**
 * Validation rules for search queries
 */
const validateSearch = [
    query('q')
        .notEmpty()
        .withMessage('Search query is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Search query must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    query('type')
        .optional()
        .isIn(['all', 'users', 'plans', 'transactions'])
        .withMessage('Invalid search type'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
        .toInt(),
    
    handleValidationErrors
];

/**
 * Validation rules for pagination
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    query('sort')
        .optional()
        .isIn(['createdAt', 'updatedAt', 'planId', 'totalEarnings'])
        .withMessage('Invalid sort field'),
    
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Order must be asc or desc'),
    
    handleValidationErrors
];

/**
 * Validation rules for admin operations
 */
const validateAdminOperation = [
    body('action')
        .notEmpty()
        .withMessage('Action is required')
        .isIn(['pause', 'unpause', 'updatePrice', 'updateStatus', 'withdraw'])
        .withMessage('Invalid admin action'),
    
    body('planId')
        .optional()
        .custom(isValidPlanId)
        .withMessage('Invalid plan ID'),
    
    body('newPrice')
        .optional()
        .custom(isValidUSDTAmount)
        .withMessage('Invalid price amount'),
    
    body('amount')
        .optional()
        .custom(isValidUSDTAmount)
        .withMessage('Invalid withdrawal amount'),
    
    handleValidationErrors
];

/**
 * Validation rules for transaction verification
 */
const validateTransaction = [
    body('transactionHash')
        .notEmpty()
        .withMessage('Transaction hash is required')
        .custom(isValidTransactionHash)
        .withMessage('Invalid transaction hash format'),
    
    body('blockNumber')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Block number must be a positive integer')
        .toInt(),
    
    body('gasUsed')
        .optional()
        .isInt({ min: 21000 })
        .withMessage('Gas used must be at least 21000')
        .toInt(),
    
    handleValidationErrors
];

/**
 * Validation rules for contact form
 */
const validateContactForm = [
    body('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('email')
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('subject')
        .notEmpty()
        .withMessage('Subject is required')
        .isLength({ min: 5, max: 200 })
        .withMessage('Subject must be between 5 and 200 characters')
        .trim()
        .escape(),
    
    body('message')
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 20, max: 1000 })
        .withMessage('Message must be between 20 and 1000 characters')
        .trim()
        .escape(),
    
    handleValidationErrors
];

/**
 * Validation rules for API key generation
 */
const validateApiKeyGeneration = [
    body('name')
        .notEmpty()
        .withMessage('API key name is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('API key name must be between 3 and 50 characters')
        .trim()
        .escape(),
    
    body('permissions')
        .optional()
        .isArray()
        .withMessage('Permissions must be an array'),
    
    body('permissions.*')
        .optional()
        .isIn(['read', 'write', 'admin'])
        .withMessage('Invalid permission type'),
    
    body('expiresIn')
        .optional()
        .isInt({ min: 3600, max: 31536000 }) // 1 hour to 1 year
        .withMessage('Expiration time must be between 1 hour and 1 year')
        .toInt(),
    
    handleValidationErrors
];

/**
 * Validation middleware for file uploads
 */
const validateFileUpload = [
    body('fileType')
        .optional()
        .isIn(['image', 'document', 'csv'])
        .withMessage('Invalid file type'),
    
    body('fileName')
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage('File name must be between 1 and 255 characters')
        .matches(/^[a-zA-Z0-9._-]+$/)
        .withMessage('File name contains invalid characters'),
    
    handleValidationErrors
];

/**
 * Validation rules for reporting
 */
const validateReportGeneration = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format')
        .toDate(),
    
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
        .toDate(),
    
    query('reportType')
        .optional()
        .isIn(['earnings', 'referrals', 'transactions', 'system'])
        .withMessage('Invalid report type'),
    
    query('format')
        .optional()
        .isIn(['json', 'csv', 'pdf'])
        .withMessage('Invalid report format'),
    
    handleValidationErrors
];

/**
 * Custom validation for date ranges
 */
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format')
        .toDate(),
    
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
        .toDate()
        .custom((endDate, { req }) => {
            if (req.query.startDate && endDate <= new Date(req.query.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    handleValidationErrors
];

/**
 * Validation for webhook endpoints
 */
const validateWebhook = [
    body('event')
        .notEmpty()
        .withMessage('Event type is required')
        .isIn(['membership.created', 'membership.upgraded', 'payment.received', 'referral.made'])
        .withMessage('Invalid event type'),
    
    body('data')
        .notEmpty()
        .withMessage('Event data is required')
        .isObject()
        .withMessage('Event data must be an object'),
    
    body('timestamp')
        .notEmpty()
        .withMessage('Timestamp is required')
        .isInt({ min: 1 })
        .withMessage('Invalid timestamp')
        .toInt(),
    
    body('signature')
        .notEmpty()
        .withMessage('Signature is required')
        .isLength({ min: 64, max: 128 })
        .withMessage('Invalid signature length'),
    
    handleValidationErrors
];

/**
 * Validation for analytics queries
 */
const validateAnalytics = [
    query('metric')
        .optional()
        .isIn(['revenue', 'users', 'transactions', 'conversion'])
        .withMessage('Invalid metric type'),
    
    query('period')
        .optional()
        .isIn(['hour', 'day', 'week', 'month', 'year'])
        .withMessage('Invalid time period'),
    
    query('groupBy')
        .optional()
        .isIn(['day', 'week', 'month', 'plan', 'referrer'])
        .withMessage('Invalid groupBy parameter'),
    
    handleValidationErrors
];

/**
 * Sanitize and validate user input for security
 */
const sanitizeUserInput = (req, res, next) => {
    // Remove potentially dangerous characters
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
            .replace(/[<>]/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    };

    // Recursively sanitize object properties
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };

    // Sanitize request body, query, and params
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }

    next();
};

/**
 * Rate limiting validation for sensitive operations
 */
const validateRateLimit = (req, res, next) => {
    const userKey = req.user?.telegramId || req.ip;
    const operation = req.route?.path || req.path;
    
    // Store rate limit data in session or redis
    if (!req.session.rateLimits) {
        req.session.rateLimits = {};
    }
    
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute
    const maxRequests = getMaxRequestsForOperation(operation);
    
    const userLimits = req.session.rateLimits[userKey] || {};
    const operationLimits = userLimits[operation] || { count: 0, resetTime: now + windowSize };
    
    // Reset counter if window has expired
    if (now > operationLimits.resetTime) {
        operationLimits.count = 0;
        operationLimits.resetTime = now + windowSize;
    }
    
    // Check if limit exceeded
    if (operationLimits.count >= maxRequests) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((operationLimits.resetTime - now) / 1000)
        });
    }
    
    // Increment counter
    operationLimits.count++;
    userLimits[operation] = operationLimits;
    req.session.rateLimits[userKey] = userLimits;
    
    next();
};

/**
 * Get maximum requests allowed for different operations
 */
const getMaxRequestsForOperation = (operation) => {
    const limits = {
        '/api/membership/update': 5,
        '/api/wallet/connect': 10,
        '/api/membership/refresh': 20,
        '/contact': 3,
        default: 50
    };
    
    return limits[operation] || limits.default;
};

/**
 * Validate blockchain data consistency
 */
const validateBlockchainData = [
    body('blockNumber')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Block number must be a positive integer'),
    
    body('gasPrice')
        .optional()
        .matches(/^\d+$/)
        .withMessage('Gas price must be a valid number'),
    
    body('gasUsed')
        .optional()
        .isInt({ min: 21000, max: 10000000 })
        .withMessage('Gas used must be between 21000 and 10000000'),
    
    body('contractAddress')
        .optional()
        .custom(isValidEthereumAddress)
        .withMessage('Invalid contract address'),
    
    handleValidationErrors
];

/**
 * Custom validation for business rules
 */
const validateBusinessRules = async (req, res, next) => {
    try {
        const { planId, walletAddress } = req.body;
        
        // Check if user can upgrade to this plan
        if (planId && req.user?.walletAddress) {
            const Membership = require('../models/Membership');
            const currentMembership = await Membership.findOne({
                walletAddress: req.user.walletAddress,
                isActive: true
            });
            
            if (currentMembership && planId !== currentMembership.planId + 1) {
                return res.status(400).json({
                    error: 'Can only upgrade to the next level sequentially'
                });
            }
        }
        
        // Additional business rule validations can be added here
        
        next();
    } catch (error) {
        console.error('Business rules validation error:', error);
        next(error);
    }
};

module.exports = {
    handleValidationErrors,
    validateWalletConnection,
    validateMembershipRegistration,
    validatePlanUpgrade,
    validateReferralCode,
    validateProfileUpdate,
    validateSearch,
    validatePagination,
    validateAdminOperation,
    validateTransaction,
    validateContactForm,
    validateApiKeyGeneration,
    validateFileUpload,
    validateReportGeneration,
    validateDateRange,
    validateWebhook,
    validateAnalytics,
    sanitizeUserInput,
    validateRateLimit,
    validateBlockchainData,
    validateBusinessRules,
    
    // Custom validators
    isValidEthereumAddress,
    isValidTransactionHash,
    isValidPlanId,
    isValidUSDTAmount
};