// src/models/Referral.js - Referral tracking model
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    referee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    planLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 16
    },
    amount: {
        type: String, // Store as string to handle large numbers
        required: true,
        default: '0'
    },
    transactionHash: {
        type: String,
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },
    blockNumber: {
        type: Number,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    commissionRate: {
        type: Number,
        default: 60, // Default 60% commission
        min: 0,
        max: 100
    },
    cycleNumber: {
        type: Number,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    paidAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes for efficient queries
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referee: 1, status: 1 });
referralSchema.index({ createdAt: -1, status: 1 });
referralSchema.index({ planLevel: 1, amount: 1 });

// Virtual for formatted amount
referralSchema.virtual('formattedAmount').get(function() {
    return (parseFloat(this.amount) / 1000000).toFixed(2); // Convert from wei to USDT
});

// Virtual for commission earned
referralSchema.virtual('commissionEarned').get(function() {
    const baseAmount = parseFloat(this.amount) / 1000000;
    return (baseAmount * this.commissionRate / 100).toFixed(2);
});

// Static methods
referralSchema.statics.findByReferrer = function(referrerId, options = {}) {
    const query = { referrer: referrerId };
    
    if (options.status) {
        query.status = options.status;
    }
    
    if (options.planLevel) {
        query.planLevel = options.planLevel;
    }
    
    return this.find(query)
        .populate('referee', 'firstName lastName username telegramId')
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50);
};

referralSchema.statics.findByReferee = function(refereeId) {
    return this.findOne({ referee: refereeId })
        .populate('referrer', 'firstName lastName username telegramId referralCode');
};

referralSchema.statics.getEarningsStats = function(referrerId, dateRange = {}) {
    const matchQuery = { 
        referrer: new mongoose.Types.ObjectId(referrerId),
        status: 'completed'
    };
    
    if (dateRange.start && dateRange.end) {
        matchQuery.createdAt = {
            $gte: new Date(dateRange.start),
            $lte: new Date(dateRange.end)
        };
    }
    
    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalEarnings: { 
                    $sum: { $toDouble: '$amount' }
                },
                totalReferrals: { $sum: 1 },
                averageEarning: { 
                    $avg: { $toDouble: '$amount' }
                },
                planDistribution: {
                    $push: '$planLevel'
                }
            }
        },
        {
            $addFields: {
                totalEarningsFormatted: {
                    $divide: ['$totalEarnings', 1000000]
                },
                averageEarningFormatted: {
                    $divide: ['$averageEarning', 1000000]
                }
            }
        }
    ]);
};

referralSchema.statics.getTopReferrers = function(limit = 10, timeframe = 'all') {
    const matchQuery = { status: 'completed' };
    
    // Add time filter if specified
    if (timeframe !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (timeframe) {
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }
        
        matchQuery.createdAt = { $gte: startDate };
    }
    
    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$referrer',
                totalEarnings: { $sum: { $toDouble: '$amount' } },
                totalReferrals: { $sum: 1 },
                averageEarning: { $avg: { $toDouble: '$amount' } }
            }
        },
        { $sort: { totalEarnings: -1 } },
        { $limit: limit },
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
                name: { 
                    $concat: ['$user.firstName', ' ', { $ifNull: ['$user.lastName', ''] }] 
                },
                username: '$user.username',
                totalEarnings: { $divide: ['$totalEarnings', 1000000] },
                totalReferrals: 1,
                averageEarning: { $divide: ['$averageEarning', 1000000] }
            }
        }
    ]);
};

// Instance methods
referralSchema.methods.markAsPaid = function(transactionHash, blockNumber) {
    this.status = 'completed';
    this.transactionHash = transactionHash;
    this.blockNumber = blockNumber;
    this.paidAt = new Date();
    return this.save();
};

referralSchema.methods.markAsFailed = function(reason) {
    this.status = 'failed';
    this.notes = reason || 'Payment failed';
    return this.save();
};

// Pre-save middleware
referralSchema.pre('save', function(next) {
    // Ensure amount is a string
    if (typeof this.amount === 'number') {
        this.amount = this.amount.toString();
    }
    
    // Validate commission rate based on plan level
    if (this.isNew && !this.commissionRate) {
        // Set commission rate based on plan level
        if (this.planLevel <= 4) {
            this.commissionRate = 50;
        } else if (this.planLevel <= 8) {
            this.commissionRate = 55;
        } else if (this.planLevel <= 12) {
            this.commissionRate = 60;
        } else {
            this.commissionRate = 60;
        }
    }
    
    next();
});

// Pre-remove middleware
referralSchema.pre('remove', function(next) {
    // Could add cleanup logic here if needed
    next();
});

// Error handling
referralSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoError' && error.code === 11000) {
        next(new Error('Duplicate referral transaction'));
    } else {
        next(error);
    }
});

module.exports = mongoose.model('Referral', referralSchema);