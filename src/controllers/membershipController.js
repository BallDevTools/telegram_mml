// src/controllers/membershipController.js
const web3Service = require('../services/web3Service');
const Membership = require('../models/Membership');
const User = require('../models/User');

const membershipController = {
  // แสดงหน้าแผนสมาชิกภาพ
  async showPlans(req, res) {
    try {
      const plans = [];
      
      // ดึงข้อมูลแผนทั้งหมด
      for (let i = 1; i <= 16; i++) {
        try {
          const planInfo = await web3Service.getPlanInfo(i);
          const cycleInfo = await web3Service.getPlanCycleInfo(i);
          
          plans.push({
            id: i,
            ...planInfo,
            ...cycleInfo,
            priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0)
          });
        } catch (error) {
          console.error(`Error fetching plan ${i}:`, error);
        }
      }

      // ตรวจสอบสมาชิกภาพปัจจุบัน
      let userMembership = null;
      if (req.user && req.user.walletAddress) {
        userMembership = await Membership.findOne({
          walletAddress: req.user.walletAddress,
          isActive: true
        });
      }

      res.render('pages/plans', {
        title: 'Membership Plans',
        plans,
        userMembership,
        telegramUser: req.telegramUser,
        user: req.user
      });
    } catch (error) {
      console.error('Error in showPlans:', error);
      res.status(500).render('error', {
        message: 'Error loading membership plans',
        telegramUser: req.telegramUser
      });
    }
  },

  // แสดง dashboard สมาชิก
  async showDashboard(req, res) {
    try {
      if (!req.user || !req.user.walletAddress) {
        return res.redirect('/wallet/connect');
      }

      // ดึงข้อมูลสมาชิกภาพจาก database
      const membership = await Membership.findOne({
        walletAddress: req.user.walletAddress,
        isActive: true
      }).populate('user');

      if (!membership) {
        return res.redirect('/membership/plans');
      }

      // ดึงข้อมูลล่าสุดจาก blockchain
      const blockchainData = await web3Service.getMemberInfo(req.user.walletAddress);
      
      if (blockchainData) {
        // อัพเดทข้อมูลใน database
        membership.totalEarnings = blockchainData.totalEarnings;
        membership.totalReferrals = parseInt(blockchainData.totalReferrals);
        membership.planId = parseInt(blockchainData.planId);
        await membership.save();
      }

      // ดึงข้อมูล referrals
      const referrals = await User.find({
        referredBy: req.user._id
      }).select('firstName lastName username telegramId createdAt');

      // ดึงสถิติระบบ
      const systemStats = await web3Service.getSystemStats();

      res.render('pages/dashboard', {
        title: 'Dashboard',
        membership,
        referrals,
        systemStats,
        telegramUser: req.telegramUser,
        user: req.user
      });
    } catch (error) {
      console.error('Error in showDashboard:', error);
      res.status(500).render('error', {
        message: 'Error loading dashboard',
        telegramUser: req.telegramUser
      });
    }
  },

  // API: ดึงข้อมูลสมาชิกภาพ
  async getMembershipData(req, res) {
    try {
      const { walletAddress } = req.params;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const blockchainData = await web3Service.getMemberInfo(walletAddress);
      const dbData = await Membership.findOne({
        walletAddress: walletAddress.toLowerCase(),
        isActive: true
      });

      res.json({
        blockchain: blockchainData,
        database: dbData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting membership data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // API: อัพเดทข้อมูลสมาชิกภาพ
  async updateMembership(req, res) {
    try {
      const { walletAddress, transactionHash, planId } = req.body;
      
      if (!walletAddress || !transactionHash) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // ตรวจสอบ transaction hash
      const tx = await web3Service.provider.getTransaction(transactionHash);
      if (!tx || !tx.blockNumber) {
        return res.status(400).json({ error: 'Invalid transaction hash' });
      }

      // อัพเดทหรือสร้างข้อมูลสมาชิกภาพ
      let membership = await Membership.findOne({
        walletAddress: walletAddress.toLowerCase()
      });

      if (membership) {
        membership.planId = planId;
        membership.transactionHash = transactionHash;
        membership.blockNumber = tx.blockNumber;
        membership.isActive = true;
      } else {
        const planInfo = await web3Service.getPlanInfo(planId);
        
        membership = new Membership({
          user: req.user._id,
          walletAddress: walletAddress.toLowerCase(),
          planId,
          planName: planInfo.name,
          transactionHash,
          blockNumber: tx.blockNumber
        });
      }

      await membership.save();

      res.json({
        success: true,
        membership,
        message: 'Membership updated successfully'
      });
    } catch (error) {
      console.error('Error updating membership:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = membershipController;