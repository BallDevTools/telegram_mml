// src/routes/index.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Membership = require('../models/Membership');
const web3Service = require('../services/web3Service');

// Middleware to ensure user exists
router.use(async (req, res, next) => {
    if (req.telegramUser) {
        try {
            let user = await User.findOne({ telegramId: req.telegramUser.id.toString() });
            
            if (!user) {
                // Create new user if doesn't exist
                user = new User({
                    telegramId: req.telegramUser.id.toString(),
                    firstName: req.telegramUser.first_name,
                    lastName: req.telegramUser.last_name,
                    username: req.telegramUser.username,
                    languageCode: req.telegramUser.language_code || 'en'
                });
                await user.save();
            } else {
                // Update last active
                user.lastActive = new Date();
                await user.save();
            }
            
            req.user = user;
        } catch (error) {
            console.error('User middleware error:', error);
        }
    }
    next();
});

// Home page
router.get('/', async (req, res) => {
    try {
        // Get system statistics
        let systemStats = {};
        try {
            systemStats = await web3Service.getSystemStats();
        } catch (error) {
            console.error('Error fetching system stats:', error);
            systemStats = {
                totalMembers: '0',
                totalRevenue: '0',
                totalCommission: '0'
            };
        }

        // Check if user has membership
        let userMembership = null;
        if (req.user && req.user.walletAddress) {
            userMembership = await Membership.findOne({
                walletAddress: req.user.walletAddress,
                isActive: true
            });
        }

        // Get recent members (for display)
        const recentMembers = await User.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .select('firstName lastName username createdAt');

        res.render('pages/index', {
            title: 'Crypto Membership NFT',
            systemStats,
            userMembership,
            recentMembers,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.status(500).render('error', {
            message: 'Error loading homepage',
            telegramUser: req.telegramUser
        });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('pages/about', {
        title: 'About Us',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

// How it works page
router.get('/how-it-works', (req, res) => {
    res.render('pages/how-it-works', {
        title: 'How It Works',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

// Referral page
router.get('/referral/:code?', async (req, res) => {
    try {
        const { code } = req.params;
        let referrer = null;

        if (code) {
            // Find referrer by code
            referrer = await User.findOne({ referralCode: code });
            
            // Store referral info in session
            if (referrer) {
                req.session.referralCode = code;
                req.session.referrerId = referrer._id;
            }
        }

        res.render('pages/referral', {
            title: 'Join via Referral',
            referrer,
            code,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Referral page error:', error);
        res.redirect('/');
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Terms and Privacy
router.get('/terms', (req, res) => {
    res.render('pages/terms', {
        title: 'Terms of Service',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

router.get('/privacy', (req, res) => {
    res.render('pages/privacy', {
        title: 'Privacy Policy',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

// Support page
router.get('/support', (req, res) => {
    res.render('pages/support', {
        title: 'Support',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

module.exports = router;