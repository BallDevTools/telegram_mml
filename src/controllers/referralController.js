// src/controllers/referralController.js
const User = require('../models/User');
const Membership = require('../models/Membership');
const Referral = require('../models/Referral');
const web3Service = require('../services/web3Service');

const referralController = {
    // Generate referral link
    async generateReferralLink(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const referralLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}/app?startapp=ref_${req.user.referralCode}`;
            
            res.json({
                success: true,
                referralCode: req.user.referralCode,
                referralLink: referralLink,
                shareText: `🚀 Join Crypto Membership NFT!\n\nUse my referral link to get started:\n${referralLink}`
            });
        } catch (error) {
            console.error('Generate referral link error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get referral statistics
    async getReferralStats(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const user = req.user;
            
            // Get direct referrals
            const directReferrals = await User.find({
                referredBy: user._id
            }).populate({
                path: 'walletAddress',
                model: 'Membership',
                match: { isActive: true },
                select: 'planId planName totalEarnings registeredAt'
            }).select('firstName lastName username telegramId createdAt walletAddress');

            // Get referral tree (multi-level)
            const referralTree = await this.buildReferralTree(user._id, 3); // 3 levels deep

            // Calculate total earnings from referrals
            let totalEarnings = 0;
            let activeReferrals = 0;
            let totalReferrals = directReferrals.length;

            for (const referral of directReferrals) {
                if (referral.walletAddress) {
                    activeReferrals++;
                    // Get actual earnings from blockchain if available
                    try {
                        const memberInfo = await web3Service.getMemberInfo(referral.walletAddress);
                        if (memberInfo) {
                            totalEarnings += parseInt(memberInfo.totalEarnings);
                        }
                    } catch (error) {
                        console.error('Error fetching member earnings:', error);
                    }
                }
            }

            // Get commission history
            const commissionHistory = await Referral.find({
                referrer: user._id
            }).populate('referee', 'firstName lastName username')
              .sort({ createdAt: -1 })
              .limit(20);

            const stats = {
                referralCode: user.referralCode,
                totalReferrals: totalReferrals,
                activeReferrals: activeReferrals,
                totalEarnings: (totalEarnings / 1000000).toFixed(2), // Convert from wei to USDT
                directReferrals: directReferrals.map(ref => ({
                    id: ref._id,
                    name: `${ref.firstName} ${ref.lastName || ''}`.trim(),
                    username: ref.username,
                    telegramId: ref.telegramId,
                    joinedAt: ref.createdAt,
                    hasMembership: !!ref.walletAddress,
                    planLevel: ref.walletAddress?.planId || 0,
                    planName: ref.walletAddress?.planName || 'No Membership'
                })),
                referralTree: referralTree,
                commissionHistory: commissionHistory.map(commission => ({
                    id: commission._id,
                    refereeName: `${commission.referee.firstName} ${commission.referee.lastName || ''}`.trim(),
                    amount: commission.amount,
                    planLevel: commission.planLevel,
                    createdAt: commission.createdAt
                })),
                conversionRate: totalReferrals > 0 ? ((activeReferrals / totalReferrals) * 100).toFixed(2) : 0
            };

            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('Get referral stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Track referral registration
    async trackReferral(referrerUserId, refereeUserId, planId, amount) {
        try {
            const referral = new Referral({
                referrer: referrerUserId,
                referee: refereeUserId,
                planLevel: planId,
                amount: amount,
                status: 'completed'
            });

            await referral.save();

            // Update referrer's total referrals count
            await User.findByIdAndUpdate(referrerUserId, {
                $inc: { totalReferrals: 1 }
            });

            return referral;
        } catch (error) {
            console.error('Track referral error:', error);
            throw error;
        }
    },

    // Process referral commission
    async processReferralCommission(req, res) {
        try {
            const { referrerAddress, refereeAddress, amount, planId, transactionHash } = req.body;

            if (!referrerAddress || !refereeAddress || !amount || !planId || !transactionHash) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Find users by wallet addresses
            const referrer = await User.findOne({ walletAddress: referrerAddress.toLowerCase() });
            const referee = await User.findOne({ walletAddress: refereeAddress.toLowerCase() });

            if (!referrer || !referee) {
                return res.status(404).json({ error: 'Users not found' });
            }

            // Track the referral
            const referral = await this.trackReferral(referrer._id, referee._id, planId, amount);

            // Send notification to referrer
            if (process.env.TELEGRAM_BOT_TOKEN) {
                try {
                    const telegramBotService = require('../services/telegramBotService');
                    const formattedAmount = (parseInt(amount) / 1000000).toFixed(2);
                    
                    await telegramBotService.notifyCommissionReceived(
                        referrer.telegramId,
                        formattedAmount,
                        referee.firstName,
                        `Level ${planId}`
                    );
                } catch (error) {
                    console.error('Error sending referral notification:', error);
                }
            }

            res.json({
                success: true,
                referral: referral,
                message: 'Referral commission processed successfully'
            });
        } catch (error) {
            console.error('Process referral commission error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get referral leaderboard
    async getLeaderboard(req, res) {
        try {
            const { period = 'all', limit = 10 } = req.query;

            let dateFilter = {};
            const now = new Date();

            switch (period) {
                case 'week':
                    dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
                    break;
                case 'month':
                    dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
                    break;
                case 'year':
                    dateFilter = { createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
                    break;
                default:
                    // 'all' - no date filter
                    break;
            }

            // Aggregate referral statistics
            const leaderboard = await Referral.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$referrer',
                        totalReferrals: { $sum: 1 },
                        totalEarnings: { $sum: '$amount' },
                        avgEarningsPerReferral: { $avg: '$amount' }
                    }
                },
                { $sort: { totalEarnings: -1 } },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        userId: '$_id',
                        name: { $concat: ['$user.firstName', ' ', { $ifNull: ['$user.lastName', ''] }] },
                        username: '$user.username',
                        totalReferrals: 1,
                        totalEarnings: { $divide: ['$totalEarnings', 1000000] }, // Convert to USDT
                        avgEarningsPerReferral: { $divide: ['$avgEarningsPerReferral', 1000000] }
                    }
                }
            ]);

            res.json({
                success: true,
                period: period,
                leaderboard: leaderboard.map((entry, index) => ({
                    rank: index + 1,
                    ...entry,
                    totalEarnings: parseFloat(entry.totalEarnings.toFixed(2)),
                    avgEarningsPerReferral: parseFloat(entry.avgEarningsPerReferral.toFixed(2))
                }))
            });
        } catch (error) {
            console.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Validate referral code
    async validateReferralCode(req, res) {
        try {
            const { code } = req.params;

            if (!code) {
                return res.status(400).json({ error: 'Referral code required' });
            }

            const referrer = await User.findOne({ referralCode: code })
                .select('firstName lastName username telegramId referralCode')
                .populate({
                    path: 'walletAddress',
                    model: 'Membership',
                    match: { isActive: true },
                    select: 'planId planName'
                });

            if (!referrer) {
                return res.status(404).json({ 
                    error: 'Invalid referral code',
                    valid: false 
                });
            }

            // Check if referrer has an active membership
            const hasMembership = !!referrer.walletAddress;

            res.json({
                success: true,
                valid: true,
                referrer: {
                    name: `${referrer.firstName} ${referrer.lastName || ''}`.trim(),
                    username: referrer.username,
                    hasMembership: hasMembership,
                    planLevel: referrer.walletAddress?.planId || 0,
                    planName: referrer.walletAddress?.planName || 'No Membership'
                }
            });
        } catch (error) {
            console.error('Validate referral code error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get referral analytics
    async getAnalytics(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.user._id;
            const { period = 30 } = req.query; // Default 30 days

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period));

            // Get daily referral stats
            const dailyStats = await Referral.aggregate([
                {
                    $match: {
                        referrer: userId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        totalReferrals: { $sum: 1 },
                        totalEarnings: { $sum: '$amount' }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                },
                {
                    $project: {
                        date: {
                            $dateFromParts: {
                                year: '$_id.year',
                                month: '$_id.month',
                                day: '$_id.day'
                            }
                        },
                        totalReferrals: 1,
                        totalEarnings: { $divide: ['$totalEarnings', 1000000] }
                    }
                }
            ]);

            // Get plan distribution
            const planDistribution = await Referral.aggregate([
                {
                    $match: {
                        referrer: userId
                    }
                },
                {
                    $group: {
                        _id: '$planLevel',
                        count: { $sum: 1 },
                        totalEarnings: { $sum: '$amount' }
                    }
                },
                {
                    $sort: { '_id': 1 }
                },
                {
                    $project: {
                        planLevel: '$_id',
                        count: 1,
                        totalEarnings: { $divide: ['$totalEarnings', 1000000] }
                    }
                }
            ]);

            // Get conversion funnel
            const totalReferralClicks = await User.countDocuments({
                referredBy: userId
            });

            const totalMemberships = await User.countDocuments({
                referredBy: userId,
                walletAddress: { $exists: true, $ne: null }
            });

            const conversionRate = totalReferralClicks > 0 ? 
                ((totalMemberships / totalReferralClicks) * 100).toFixed(2) : 0;

            res.json({
                success: true,
                analytics: {
                    period: parseInt(period),
                    dailyStats: dailyStats.map(stat => ({
                        date: stat.date.toISOString().split('T')[0],
                        referrals: stat.totalReferrals,
                        earnings: parseFloat(stat.totalEarnings.toFixed(2))
                    })),
                    planDistribution: planDistribution.map(plan => ({
                        planLevel: plan.planLevel,
                        count: plan.count,
                        earnings: parseFloat(plan.totalEarnings.toFixed(2))
                    })),
                    conversionFunnel: {
                        clicks: totalReferralClicks,
                        signups: totalReferralClicks,
                        memberships: totalMemberships,
                        conversionRate: parseFloat(conversionRate)
                    }
                }
            });
        } catch (error) {
            console.error('Get analytics error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Helper function to build referral tree
    async buildReferralTree(userId, maxDepth = 3, currentDepth = 0) {
        if (currentDepth >= maxDepth) return [];

        const directReferrals = await User.find({ referredBy: userId })
            .select('firstName lastName username telegramId createdAt walletAddress')
            .populate({
                path: 'walletAddress',
                model: 'Membership',
                match: { isActive: true },
                select: 'planId planName'
            });

        const tree = [];
        for (const referral of directReferrals) {
            const children = await this.buildReferralTree(referral._id, maxDepth, currentDepth + 1);
            
            tree.push({
                id: referral._id,
                name: `${referral.firstName} ${referral.lastName || ''}`.trim(),
                username: referral.username,
                joinedAt: referral.createdAt,
                level: currentDepth + 1,
                hasMembership: !!referral.walletAddress,
                planLevel: referral.walletAddress?.planId || 0,
                children: children
            });
        }

        return tree;
    },

    // Bulk import referral data (admin only)
    async bulkImport(req, res) {
        try {
            // Check admin privileges
            if (!req.user || req.user.walletAddress?.toLowerCase() !== process.env.CONTRACT_OWNER_ADDRESS?.toLowerCase()) {
                return res.status(403).json({ error: 'Admin privileges required' });
            }

            const { referrals } = req.body;
            
            if (!Array.isArray(referrals)) {
                return res.status(400).json({ error: 'Referrals must be an array' });
            }

            const results = {
                success: 0,
                failed: 0,
                errors: []
            };

            for (const referralData of referrals) {
                try {
                    const referral = new Referral(referralData);
                    await referral.save();
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        data: referralData,
                        error: error.message
                    });
                }
            }

            res.json({
                success: true,
                results: results
            });
        } catch (error) {
            console.error('Bulk import error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = referralController;