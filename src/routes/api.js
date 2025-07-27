// src/routes/api.js
const express = require('express');
const router = express.Router();
const web3Service = require('../services/web3Service');
const Membership = require('../models/Membership');
const User = require('../models/User');

// Get contract ABI
router.get('/contract/abi', (req, res) => {
    try {
        const abi = require('../../contracts/abi/CryptoMembershipNFT.json');
        res.json(abi);
    } catch (error) {
        res.status(500).json({ error: 'ABI not found' });
    }
});

// Get membership data by wallet address
router.get('/membership/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // Get data from blockchain
        const blockchainData = await web3Service.getMemberInfo(walletAddress);
        
        // Get data from database
        const dbData = await Membership.findOne({
            walletAddress: walletAddress.toLowerCase(),
            isActive: true
        }).populate('user');
        
        res.json({
            blockchain: blockchainData,
            database: dbData,
            synced: !!(blockchainData && dbData)
        });
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update membership after transaction
router.post('/membership/update', async (req, res) => {
    try {
        const { transactionHash, planId, walletAddress } = req.body;
        
        if (!transactionHash || !planId || !walletAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Verify transaction
        const tx = await web3Service.provider.getTransaction(transactionHash);
        if (!tx || !tx.blockNumber) {
            return res.status(400).json({ error: 'Invalid transaction' });
        }
        
        // Get plan info
        const planInfo = await web3Service.getPlanInfo(planId);
        
        // Find or create user
        let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        if (!user && req.user) {
            user = req.user;
            user.walletAddress = walletAddress.toLowerCase();
            await user.save();
        }
        
        // Update or create membership
        let membership = await Membership.findOne({
            walletAddress: walletAddress.toLowerCase()
        });
        
        if (membership) {
            membership.planId = planId;
            membership.planName = planInfo.name;
            membership.transactionHash = transactionHash;
            membership.blockNumber = tx.blockNumber;
            membership.isActive = true;
        } else {
            membership = new Membership({
                user: user?._id,
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
            membership
        });
    } catch (error) {
        console.error('Update membership error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh membership data from blockchain
router.post('/membership/refresh', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const walletAddress = req.user.walletAddress;
        
        // Get latest data from blockchain
        const blockchainData = await web3Service.getMemberInfo(walletAddress);
        
        if (blockchainData) {
            // Update database
            const membership = await Membership.findOne({
                walletAddress: walletAddress.toLowerCase(),
                isActive: true
            });
            
            if (membership) {
                membership.totalEarnings = blockchainData.totalEarnings;
                membership.totalReferrals = parseInt(blockchainData.totalReferrals);
                membership.planId = parseInt(blockchainData.planId);
                membership.cycleNumber = parseInt(blockchainData.cycleNumber);
                await membership.save();
            }
        }
        
        res.json({
            success: true,
            data: blockchainData
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get system statistics
router.get('/stats/system', async (req, res) => {
    try {
        const stats = await web3Service.getSystemStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get plan information
router.get('/plans/:planId', async (req, res) => {
    try {
        const { planId } = req.params;
        const planInfo = await web3Service.getPlanInfo(parseInt(planId));
        const cycleInfo = await web3Service.getPlanCycleInfo(parseInt(planId));
        
        res.json({
            ...planInfo,
            ...cycleInfo,
            priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0)
        });
    } catch (error) {
        console.error('Plan info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all plans
router.get('/plans', async (req, res) => {
    try {
        const plans = [];
        
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
        
        res.json(plans);
    } catch (error) {
        console.error('Plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;