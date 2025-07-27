// src/middleware/auth.js
const User = require('../models/User');
const Membership = require('../models/Membership');
const jwt = require('jsonwebtoken');

/**
 * Middleware to ensure user exists in database
 */
async function ensureUser(req, res, next) {
    try {
        if (!req.telegramUser) {
            return next();
        }

        let user = await User.findOne({ 
            telegramId: req.telegramUser.id.toString() 
        });

        if (!user) {
            // Create new user
            user = new User({
                telegramId: req.telegramUser.id.toString(),
                firstName: req.telegramUser.first_name,
                lastName: req.telegramUser.last_name,
                username: req.telegramUser.username,
                languageCode: req.telegramUser.language_code || 'en'
            });

            // Handle referral if exists
            if (req.session.referralCode) {
                const referrer = await User.findOne({ 
                    referralCode: req.session.referralCode 
                });
                if (referrer) {
                    user.referredBy = referrer._id;
                }
            }

            await user.save();
        } else {
            // Update user data
            user.firstName = req.telegramUser.first_name;
            user.lastName = req.telegramUser.last_name;
            user.username = req.telegramUser.username;
            user.languageCode = req.telegramUser.language_code || user.languageCode;
            user.lastActive = new Date();
            await user.save();
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('ensureUser middleware error:', error);
        next();
    }
}

/**
 * Middleware to require authenticated user
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        } else {
            return res.redirect('/');
        }
    }
    next();
}

/**
 * Middleware to require wallet connection
 */
function requireWallet(req, res, next) {
    if (!req.user || !req.user.walletAddress) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                error: 'Wallet connection required' 
            });
        } else {
            return res.redirect('/wallet/connect');
        }
    }
    next();
}

/**
 * Middleware to require membership
 */
async function requireMembership(req, res, next) {
    try {
        if (!req.user || !req.user.walletAddress) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ 
                    error: 'Membership required' 
                });
            } else {
                return res.redirect('/membership/plans');
            }
        }

        const membership = await Membership.findOne({
            walletAddress: req.user.walletAddress,
            isActive: true
        });

        if (!membership) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({ 
                    error: 'Active membership required' 
                });
            } else {
                return res.redirect('/membership/plans');
            }
        }

        req.membership = membership;
        next();
    } catch (error) {
        console.error('requireMembership middleware error:', error);
        next(error);
    }
}

/**
 * Middleware to check membership level
 */
function requireMembershipLevel(minLevel) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.walletAddress) {
                return res.status(401).json({ 
                    error: 'Authentication required' 
                });
            }

            const membership = await Membership.findOne({
                walletAddress: req.user.walletAddress,
                isActive: true
            });

            if (!membership || membership.planId < minLevel) {
                return res.status(403).json({ 
                    error: `Membership level ${minLevel} or higher required` 
                });
            }

            req.membership = membership;
            next();
        } catch (error) {
            console.error('requireMembershipLevel middleware error:', error);
            next(error);
        }
    };
}

/**
 * Generate JWT token for API authentication
 */
function generateToken(user) {
    return jwt.sign(
        { 
            id: user._id,
            telegramId: user.telegramId,
            walletAddress: user.walletAddress
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    } catch (error) {
        return null;
    }
}

/**
 * Middleware for JWT authentication (for API endpoints)
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.tokenUser = decoded;
    next();
}

/**
 * Middleware to check if user owns a specific wallet
 */
function requireWalletOwnership(req, res, next) {
    const { walletAddress } = req.params;
    
    if (!req.user || !req.user.walletAddress) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: 'Wallet ownership required' });
    }

    next();
}

/**
 * Middleware to check admin privileges (contract owner)
 */
async function requireAdmin(req, res, next) {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if user is contract owner
        const contractOwner = process.env.CONTRACT_OWNER_ADDRESS?.toLowerCase();
        const userAddress = req.user.walletAddress.toLowerCase();

        if (contractOwner && userAddress === contractOwner) {
            req.isAdmin = true;
            return next();
        }

        // Alternative: Check if user has admin role in database
        const adminUser = await User.findOne({
            _id: req.user._id,
            role: 'admin'
        });

        if (adminUser) {
            req.isAdmin = true;
            return next();
        }

        return res.status(403).json({ error: 'Admin privileges required' });
    } catch (error) {
        console.error('requireAdmin middleware error:', error);
        next(error);
    }
}

/**
 * Middleware to check if user can perform action on specific plan
 */
function requirePlanAccess(req, res, next) {
    const { planId } = req.params;
    const requestedPlan = parseInt(planId);

    if (!req.membership) {
        return res.status(403).json({ 
            error: 'Membership required' 
        });
    }

    // User can only access their current plan or the next level
    if (requestedPlan > req.membership.planId + 1) {
        return res.status(403).json({ 
            error: 'Plan access denied. Upgrade gradually.' 
        });
    }

    next();
}

/**
 * Middleware to handle session timeout
 */
function handleSessionTimeout(req, res, next) {
    if (req.session.lastAccess) {
        const timeoutDuration = 24 * 60 * 60 * 1000; // 24 hours
        const timeSinceLastAccess = Date.now() - req.session.lastAccess;

        if (timeSinceLastAccess > timeoutDuration) {
            req.session.destroy((err) => {
                if (err) console.error('Session destroy error:', err);
            });
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ error: 'Session expired' });
            } else {
                return res.redirect('/');
            }
        }
    }

    req.session.lastAccess = Date.now();
    next();
}

/**
 * Middleware to log user activity
 */
function logUserActivity(req, res, next) {
    if (req.user) {
        // Update last active timestamp
        User.findByIdAndUpdate(
            req.user._id,
            { lastActive: new Date() },
            { new: false }
        ).catch(err => console.error('Error updating last active:', err));
    }
    next();
}

module.exports = {
    ensureUser,
    requireAuth,
    requireWallet,
    requireMembership,
    requireMembershipLevel,
    generateToken,
    verifyToken,
    authenticateToken,
    requireWalletOwnership,
    requireAdmin,
    requirePlanAccess,
    handleSessionTimeout,
    logUserActivity
};