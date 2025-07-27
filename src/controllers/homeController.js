// src/controllers/homeController.js
const web3Service = require('../services/web3Service');
const Membership = require('../models/Membership');
const User = require('../models/User');

const homeController = {
    // Home page
    async index(req, res) {
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
                    totalCommission: '0',
                    ownerFunds: '0',
                    feeFunds: '0',
                    fundFunds: '0'
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

            // Get recent members for showcase
            const recentMembers = await User.find({})
                .sort({ createdAt: -1 })
                .limit(10)
                .select('firstName lastName username createdAt')
                .lean();

            // Get featured plans (1, 4, 8, 16)
            const featuredPlans = [];
            for (const planId of [1, 4, 8, 16]) {
                try {
                    const planInfo = await web3Service.getPlanInfo(planId);
                    const cycleInfo = await web3Service.getPlanCycleInfo(planId);
                    
                    featuredPlans.push({
                        id: planId,
                        ...planInfo,
                        ...cycleInfo,
                        priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0)
                    });
                } catch (error) {
                    console.error(`Error fetching plan ${planId}:`, error);
                }
            }

            res.render('pages/index', {
                title: 'Crypto Membership NFT',
                systemStats,
                userMembership,
                recentMembers,
                featuredPlans,
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
    },

    // About page
    async about(req, res) {
        try {
            res.render('pages/about', {
                title: 'About Us',
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('About page error:', error);
            res.status(500).render('error', {
                message: 'Error loading about page',
                telegramUser: req.telegramUser
            });
        }
    },

    // How it works page
    async howItWorks(req, res) {
        try {
            // Get example plan data
            let examplePlan = null;
            try {
                const planInfo = await web3Service.getPlanInfo(1);
                examplePlan = {
                    ...planInfo,
                    priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0)
                };
            } catch (error) {
                console.error('Error fetching example plan:', error);
            }

            res.render('pages/how-it-works', {
                title: 'How It Works',
                examplePlan,
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('How it works page error:', error);
            res.status(500).render('error', {
                message: 'Error loading how it works page',
                telegramUser: req.telegramUser
            });
        }
    },

    // Terms of service
    async terms(req, res) {
        try {
            res.render('pages/terms', {
                title: 'Terms of Service',
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('Terms page error:', error);
            res.status(500).render('error', {
                message: 'Error loading terms page',
                telegramUser: req.telegramUser
            });
        }
    },

    // Privacy policy
    async privacy(req, res) {
        try {
            res.render('pages/privacy', {
                title: 'Privacy Policy',
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('Privacy page error:', error);
            res.status(500).render('error', {
                message: 'Error loading privacy page',
                telegramUser: req.telegramUser
            });
        }
    },

    // Support page
    async support(req, res) {
        try {
            const faqItems = [
                {
                    question: "How do I join the membership program?",
                    answer: "Connect your wallet, choose a plan starting from Level 1, and pay with USDT. You'll receive a unique NFT membership card."
                },
                {
                    question: "Can I upgrade my membership level?",
                    answer: "Yes! You can upgrade to the next level by paying the price difference. Upgrades must be done sequentially (Level 1 → 2 → 3, etc.)."
                },
                {
                    question: "How does the referral system work?",
                    answer: "Share your referral link with friends. When they join and purchase a membership, you earn commissions based on your plan level."
                },
                {
                    question: "Are the NFTs transferable?",
                    answer: "No, membership NFTs are non-transferable (soulbound) and tied to your wallet address for security."
                },
                {
                    question: "What wallets are supported?",
                    answer: "We support MetaMask, Trust Wallet, WalletConnect, and other BSC-compatible wallets."
                },
                {
                    question: "Can I exit my membership?",
                    answer: "Yes, after 30 days you can exit and receive a 30% refund from the fund pool."
                }
            ];

            res.render('pages/support', {
                title: 'Support & FAQ',
                faqItems,
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('Support page error:', error);
            res.status(500).render('error', {
                message: 'Error loading support page',
                telegramUser: req.telegramUser
            });
        }
    },

    // Statistics API
    async getStats(req, res) {
        try {
            const systemStats = await web3Service.getSystemStats();
            
            // Get additional database stats
            const totalUsers = await User.countDocuments();
            const activeMemberships = await Membership.countDocuments({ isActive: true });
            const totalReferrals = await User.countDocuments({ referredBy: { $exists: true } });

            const stats = {
                blockchain: systemStats,
                database: {
                    totalUsers,
                    activeMemberships,
                    totalReferrals
                },
                combined: {
                    totalMembers: Math.max(parseInt(systemStats.totalMembers), activeMemberships),
                    totalRevenue: systemStats.totalRevenue,
                    totalCommission: systemStats.totalCommission,
                    conversionRate: totalUsers > 0 ? (activeMemberships / totalUsers * 100).toFixed(2) : 0
                }
            };

            res.json(stats);
        } catch (error) {
            console.error('Stats API error:', error);
            res.status(500).json({ error: 'Error fetching statistics' });
        }
    },

    // Search functionality
    async search(req, res) {
        try {
            const { q, type = 'all' } = req.query;
            
            if (!q || q.length < 2) {
                return res.json({ results: [] });
            }

            const results = [];

            // Search users (if allowed)
            if (type === 'all' || type === 'users') {
                const users = await User.find({
                    $or: [
                        { firstName: new RegExp(q, 'i') },
                        { lastName: new RegExp(q, 'i') },
                        { username: new RegExp(q, 'i') }
                    ]
                })
                .limit(5)
                .select('firstName lastName username telegramId')
                .lean();

                results.push(...users.map(user => ({
                    type: 'user',
                    title: `${user.firstName} ${user.lastName || ''}`.trim(),
                    subtitle: user.username ? `@${user.username}` : `ID: ${user.telegramId}`,
                    url: `/profile/${user.telegramId}`
                })));
            }

            // Search plans
            if (type === 'all' || type === 'plans') {
                for (let i = 1; i <= 16; i++) {
                    try {
                        const plan = await web3Service.getPlanInfo(i);
                        if (plan.name.toLowerCase().includes(q.toLowerCase())) {
                            results.push({
                                type: 'plan',
                                title: `${plan.name} Plan`,
                                subtitle: `Level ${i} - ${(parseInt(plan.price) / 1000000).toFixed(0)} USDT`,
                                url: `/membership/plans#plan-${i}`
                            });
                        }
                    } catch (error) {
                        // Skip if plan not found
                    }
                }
            }

            res.json({ results: results.slice(0, 10) });
        } catch (error) {
            console.error('Search error:', error);
            res.status(500).json({ error: 'Search error' });
        }
    },

    // Health check
    async health(req, res) {
        try {
            const health = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV,
                version: process.env.npm_package_version || '1.0.0'
            };

            // Test database connection
            try {
                await User.findOne().limit(1);
                health.database = 'connected';
            } catch (error) {
                health.database = 'disconnected';
                health.status = 'WARNING';
            }

            // Test blockchain connection
            try {
                await web3Service.contract.getTotalPlanCount();
                health.blockchain = 'connected';
            } catch (error) {
                health.blockchain = 'disconnected';
                health.status = 'WARNING';
            }

            const statusCode = health.status === 'OK' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
};

module.exports = homeController;