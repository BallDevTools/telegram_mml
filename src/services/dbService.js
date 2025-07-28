// src/services/dbService.js - Database operations service
const mongoose = require('mongoose');
const User = require('../models/User');
const Membership = require('../models/Membership');
const Referral = require('../models/Referral');

class DatabaseService {
    constructor() {
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetryAttempts = 5;
        this.retryDelay = 5000;
    }

    // Connection Management
    async connect() {
        if (this.isConnected) {
            return true;
        }

        try {
            this.connectionAttempts++;
            console.log(`🔌 Connecting to MongoDB... (Attempt ${this.connectionAttempts}/${this.maxRetryAttempts})`);
            
            if (!process.env.MONGODB_URI) {
                throw new Error('MONGODB_URI not found in environment variables');
            }
            
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4,
                retryWrites: true,
                retryReads: true
            });

            this.isConnected = true;
            this.connectionAttempts = 0;
            console.log('✅ MongoDB Connected Successfully');
            
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            this.isConnected = false;
            
            if (this.connectionAttempts < this.maxRetryAttempts) {
                console.log(`🔄 Retrying connection in ${this.retryDelay/1000} seconds...`);
                setTimeout(() => this.connect(), this.retryDelay);
            } else {
                console.log('⚠️ Max connection attempts reached');
            }
            return false;
        }
    }

    setupEventListeners() {
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            this.isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
            this.isConnected = false;
            
            // Auto-reconnect
            if (this.connectionAttempts < this.maxRetryAttempts) {
                setTimeout(() => this.connect(), this.retryDelay);
            }
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
            this.isConnected = true;
        });
    }

    async disconnect() {
        try {
            await mongoose.connection.close();
            this.isConnected = false;
            console.log('🔌 MongoDB connection closed');
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }

    // User Operations
    async createUser(userData) {
        try {
            const user = new User(userData);
            await user.save();
            console.log(`👤 User created: ${user.firstName} (${user.telegramId})`);
            return user;
        } catch (error) {
            if (error.code === 11000) {
                // User already exists, find and return
                return await User.findOne({ telegramId: userData.telegramId });
            }
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async updateUser(telegramId, updateData) {
        try {
            const user = await User.findOneAndUpdate(
                { telegramId: telegramId.toString() },
                { 
                    ...updateData,
                    lastActive: new Date()
                },
                { new: true, upsert: false }
            );
            
            if (!user) {
                throw new Error('User not found');
            }
            
            return user;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async findUserByTelegramId(telegramId) {
        try {
            return await User.findOne({ telegramId: telegramId.toString() });
        } catch (error) {
            console.error('Error finding user by Telegram ID:', error);
            return null;
        }
    }

    async findUserByWallet(walletAddress) {
        try {
            return await User.findOne({ 
                walletAddress: walletAddress.toLowerCase() 
            });
        } catch (error) {
            console.error('Error finding user by wallet:', error);
            return null;
        }
    }

    async findUserByReferralCode(referralCode) {
        try {
            return await User.findOne({ referralCode });
        } catch (error) {
            console.error('Error finding user by referral code:', error);
            return null;
        }
    }

    // Membership Operations
    async createMembership(membershipData) {
        try {
            const membership = new Membership(membershipData);
            await membership.save();
            console.log(`🎫 Membership created: ${membership.planName} for ${membership.walletAddress}`);
            return membership;
        } catch (error) {
            console.error('Error creating membership:', error);
            throw error;
        }
    }

    async updateMembership(walletAddress, updateData) {
        try {
            const membership = await Membership.findOneAndUpdate(
                { walletAddress: walletAddress.toLowerCase() },
                updateData,
                { new: true, upsert: false }
            );
            
            if (!membership) {
                throw new Error('Membership not found');
            }
            
            return membership;
        } catch (error) {
            console.error('Error updating membership:', error);
            throw error;
        }
    }

    async findMembershipByWallet(walletAddress) {
        try {
            return await Membership.findOne({ 
                walletAddress: walletAddress.toLowerCase(),
                isActive: true 
            }).populate('user');
        } catch (error) {
            console.error('Error finding membership by wallet:', error);
            return null;
        }
    }

    async findMembershipsByUser(userId) {
        try {
            return await Membership.find({ 
                user: userId 
            }).sort({ createdAt: -1 });
        } catch (error) {
            console.error('Error finding memberships by user:', error);
            return [];
        }
    }

    async getActiveMemberships(options = {}) {
        try {
            const query = { isActive: true };
            
            if (options.planId) {
                query.planId = options.planId;
            }
            
            if (options.minLevel) {
                query.planId = { $gte: options.minLevel };
            }
            
            return await Membership.find(query)
                .populate('user', 'firstName lastName username telegramId')
                .sort(options.sort || { createdAt: -1 })
                .limit(options.limit || 100);
        } catch (error) {
            console.error('Error getting active memberships:', error);
            return [];
        }
    }

    // Referral Operations
    async createReferral(referralData) {
        try {
            const referral = new Referral(referralData);
            await referral.save();
            console.log(`🔗 Referral created: ${referral.amount} from ${referral.referee} to ${referral.referrer}`);
            return referral;
        } catch (error) {
            console.error('Error creating referral:', error);
            throw error;
        }
    }

    async findReferralsByReferrer(referrerId, options = {}) {
        try {
            return await Referral.findByReferrer(referrerId, options);
        } catch (error) {
            console.error('Error finding referrals by referrer:', error);
            return [];
        }
    }

    async findReferralByReferee(refereeId) {
        try {
            return await Referral.findByReferee(refereeId);
        } catch (error) {
            console.error('Error finding referral by referee:', error);
            return null;
        }
    }

    async updateReferralStatus(referralId, status, additionalData = {}) {
        try {
            const referral = await Referral.findByIdAndUpdate(
                referralId,
                { 
                    status, 
                    ...additionalData,
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!referral) {
                throw new Error('Referral not found');
            }
            
            return referral;
        } catch (error) {
            console.error('Error updating referral status:', error);
            throw error;
        }
    }

    // Analytics and Statistics
    async getUserStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const membership = await Membership.findOne({ 
                user: userId, 
                isActive: true 
            });

            const referrals = await Referral.find({ 
                referrer: userId,
                status: 'completed' 
            });

            const directReferrals = await User.find({ 
                referredBy: userId 
            }).countDocuments();

            const totalEarnings = referrals.reduce((sum, ref) => {
                return sum + parseFloat(ref.amount);
            }, 0);

            return {
                user: {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName || ''}`.trim(),
                    telegramId: user.telegramId,
                    referralCode: user.referralCode,
                    joinedAt: user.createdAt,
                    lastActive: user.lastActive
                },
                membership: membership ? {
                    planId: membership.planId,
                    planName: membership.planName,
                    registeredAt: membership.registeredAt,
                    cycleNumber: membership.cycleNumber
                } : null,
                earnings: {
                    total: (totalEarnings / 1000000).toFixed(2),
                    count: referrals.length
                },
                referrals: {
                    direct: directReferrals,
                    successful: referrals.length
                }
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }

    async getSystemStats() {
        try {
            const totalUsers = await User.countDocuments();
            const activeMemberships = await Membership.countDocuments({ isActive: true });
            const totalReferrals = await Referral.countDocuments({ status: 'completed' });
            
            const earningsStats = await Referral.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: { $toDouble: '$amount' } },
                        averageEarning: { $avg: { $toDouble: '$amount' } }
                    }
                }
            ]);

            const planDistribution = await Membership.aggregate([
                { $match: { isActive: true } },
                {
                    $group: {
                        _id: '$planId',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            const recentActivity = await Membership.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('user', 'firstName lastName');

            return {
                overview: {
                    totalUsers,
                    activeMemberships,
                    totalReferrals,
                    conversionRate: totalUsers > 0 ? (activeMemberships / totalUsers * 100).toFixed(2) : 0
                },
                earnings: {
                    total: earningsStats.length > 0 ? (earningsStats[0].totalEarnings / 1000000).toFixed(2) : 0,
                    average: earningsStats.length > 0 ? (earningsStats[0].averageEarning / 1000000).toFixed(2) : 0
                },
                planDistribution,
                recentActivity: recentActivity.map(m => ({
                    user: m.user ? `${m.user.firstName} ${m.user.lastName || ''}`.trim() : 'Unknown',
                    plan: m.planName,
                    level: m.planId,
                    date: m.createdAt
                }))
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            throw error;
        }
    }

    async getTopReferrers(limit = 10, timeframe = 'all') {
        try {
            return await Referral.getTopReferrers(limit, timeframe);
        } catch (error) {
            console.error('Error getting top referrers:', error);
            return [];
        }
    }

    // Data Synchronization
    async syncMembershipData(walletAddress, blockchainData) {
        try {
            const membership = await Membership.findOne({ 
                walletAddress: walletAddress.toLowerCase() 
            });

            if (!membership) {
                console.log(`No membership found for ${walletAddress}`);
                return null;
            }

            // Update with blockchain data
            membership.totalEarnings = blockchainData.totalEarnings;
            membership.totalReferrals = parseInt(blockchainData.totalReferrals);
            membership.cycleNumber = parseInt(blockchainData.cycleNumber);
            
            await membership.save();
            
            console.log(`✅ Membership data synced for ${walletAddress}`);
            return membership;
        } catch (error) {
            console.error('Error syncing membership data:', error);
            throw error;
        }
    }

    async syncUserReferrals(userId, referralData) {
        try {
            for (const ref of referralData) {
                await Referral.findOneAndUpdate(
                    { 
                        referrer: userId,
                        transactionHash: ref.transactionHash 
                    },
                    {
                        ...ref,
                        status: 'completed'
                    },
                    { upsert: true, new: true }
                );
            }
            
            console.log(`✅ Referral data synced for user ${userId}`);
        } catch (error) {
            console.error('Error syncing referral data:', error);
            throw error;
        }
    }

    // Cleanup and Maintenance
    async cleanupInactiveUsers(daysInactive = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

            const result = await User.updateMany(
                { 
                    lastActive: { $lt: cutoffDate },
                    walletAddress: { $exists: false }
                },
                { isActive: false }
            );

            console.log(`🧹 Marked ${result.modifiedCount} users as inactive`);
            return result.modifiedCount;
        } catch (error) {
            console.error('Error cleaning up inactive users:', error);
            return 0;
        }
    }

    async cleanupFailedReferrals(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await Referral.deleteMany({
                status: 'failed',
                createdAt: { $lt: cutoffDate }
            });

            console.log(`🧹 Cleaned up ${result.deletedCount} failed referrals`);
            return result.deletedCount;
        } catch (error) {
            console.error('Error cleaning up failed referrals:', error);
            return 0;
        }
    }

    // Search and Query
    async searchUsers(query, options = {}) {
        try {
            const searchRegex = new RegExp(query, 'i');
            const searchQuery = {
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { username: searchRegex }
                ]
            };

            if (options.hasWallet) {
                searchQuery.walletAddress = { $exists: true, $ne: null };
            }

            if (options.isActive !== undefined) {
                searchQuery.isActive = options.isActive;
            }

            return await User.find(searchQuery)
                .select('firstName lastName username telegramId walletAddress createdAt')
                .sort({ createdAt: -1 })
                .limit(options.limit || 20);
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    async findMembershipsByPlan(planId, options = {}) {
        try {
            const query = { planId, isActive: true };
            
            return await Membership.find(query)
                .populate('user', 'firstName lastName username')
                .sort(options.sort || { createdAt: -1 })
                .limit(options.limit || 50);
        } catch (error) {
            console.error('Error finding memberships by plan:', error);
            return [];
        }
    }

    // Health Check
    async healthCheck() {
        try {
            // Test database connection
            const adminDb = mongoose.connection.db.admin();
            const result = await adminDb.ping();
            
            // Test collection access
            const userCount = await User.countDocuments();
            const membershipCount = await Membership.countDocuments();
            
            return {
                status: 'healthy',
                connected: this.isConnected,
                ping: result.ok === 1,
                collections: {
                    users: userCount,
                    memberships: membershipCount
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: this.isConnected,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Backup and Export
    async exportUserData(userId, format = 'json') {
        try {
            const user = await User.findById(userId);
            const memberships = await Membership.find({ user: userId });
            const referrals = await Referral.find({ 
                $or: [{ referrer: userId }, { referee: userId }] 
            });

            const data = {
                user,
                memberships,
                referrals,
                exportedAt: new Date().toISOString()
            };

            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            }

            return data;
        } catch (error) {
            console.error('Error exporting user data:', error);
            throw error;
        }
    }

    // Migration and Seeding
    async seedInitialData() {
        try {
            // Check if data already exists
            const userCount = await User.countDocuments();
            if (userCount > 0) {
                console.log('Database already has data, skipping seed');
                return;
            }

            // Create sample admin user if in development
            if (process.env.NODE_ENV === 'development') {
                const adminUser = new User({
                    telegramId: '123456789',
                    firstName: 'Admin',
                    lastName: 'User',
                    username: 'admin',
                    walletAddress: process.env.CONTRACT_OWNER_ADDRESS?.toLowerCase(),
                    isActive: true
                });

                await adminUser.save();
                console.log('✅ Admin user created for development');
            }

            console.log('✅ Database seeding completed');
        } catch (error) {
            console.error('Error seeding database:', error);
        }
    }
}

module.exports = new DatabaseService();