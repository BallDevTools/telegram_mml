// src/models/Membership.js
const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  planId: {
    type: Number,
    required: true,
    min: 1,
    max: 16
  },
  planName: {
    type: String,
    required: true
  },
  tokenId: Number,
  cycleNumber: {
    type: Number,
    default: 1
  },
  uplineAddress: {
    type: String,
    lowercase: true
  },
  totalEarnings: {
    type: String,
    default: '0'
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  transactionHash: String,
  blockNumber: Number,
  registeredAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for quick lookups
membershipSchema.index({ walletAddress: 1 });
membershipSchema.index({ user: 1 });
membershipSchema.index({ planId: 1 });

module.exports = mongoose.model('Membership', membershipSchema);