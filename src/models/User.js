// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: String,
  username: String,
  languageCode: {
    type: String,
    default: 'en'
  },
  walletAddress: {
    type: String,
    lowercase: true
  },
  referralCode: {
    type: String,
    unique: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate referral code before saving
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = generateReferralCode(this.telegramId);
  }
  next();
});

function generateReferralCode(telegramId) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(telegramId + Date.now()).digest('hex').substring(0, 8);
}

module.exports = mongoose.model('User', userSchema);