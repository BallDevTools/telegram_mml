// src/routes/membership.js
const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { sanitizeInput, transactionLimiter } = require('../middleware/security');

// Show all membership plans
router.get('/plans', membershipController.showPlans);

// Show member dashboard
router.get('/dashboard', membershipController.showDashboard);

// Show upgrade page
router.get('/upgrade', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.redirect('/wallet/connect');
        }

        const membership = await Membership.findOne({
            walletAddress: req.user.walletAddress,
            isActive: true
        });

        if (!membership) {
            return res.redirect('/membership/plans');
        }

        // Get available upgrade plans
        const plans = [];
        for (let i = membership.planId + 1; i <= 16; i++) {
            try {
                const planInfo = await web3Service.getPlanInfo(i);
                const cycleInfo = await web3Service.getPlanCycleInfo(i);
                
                plans.push({
                    id: i,
                    ...planInfo,
                    ...cycleInfo,
                    priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0),
                    upgradeCost: ((parseInt(planInfo.price) - parseInt(membership.planPrice || 0)) / 1000000).toFixed(0)
                });
            } catch (error) {
                console.error(`Error fetching plan ${i}:`, error);
            }
        }

        res.render('pages/upgrade', {
            title: 'Upgrade Membership',
            currentMembership: membership,
            availablePlans: plans,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Upgrade page error:', error);
        res.status(500).render('error', {
            message: 'Error loading upgrade page',
            telegramUser: req.telegramUser
        });
    }
});

// Show NFT gallery
router.get('/nft', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.redirect('/wallet/connect');
        }

        const membership = await Membership.findOne({
            walletAddress: req.user.walletAddress,
            isActive: true
        });

        if (!membership) {
            return res.redirect('/membership/plans');
        }

        // Get NFT data from blockchain
        let nftData = null;
        try {
            if (membership.tokenId) {
                nftData = await web3Service.getNFTImage(membership.tokenId);
            }
        } catch (error) {
            console.error('Error fetching NFT data:', error);
        }

        res.render('pages/nft', {
            title: 'Your NFT',
            membership,
            nftData,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('NFT page error:', error);
        res.status(500).render('error', {
            message: 'Error loading NFT page',
            telegramUser: req.telegramUser
        });
    }
});

// Show earnings history
router.get('/earnings', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.redirect('/wallet/connect');
        }

        const membership = await Membership.findOne({
            walletAddress: req.user.walletAddress,
            isActive: true
        });

        if (!membership) {
            return res.redirect('/membership/plans');
        }

        // Get referrals and their earnings
        const referrals = await User.find({
            referredBy: req.user._id
        }).populate({
            path: 'walletAddress',
            model: 'Membership',
            match: { isActive: true }
        });

        res.render('pages/earnings', {
            title: 'Earnings History',
            membership,
            referrals,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Earnings page error:', error);
        res.status(500).render('error', {
            message: 'Error loading earnings page',
            telegramUser: req.telegramUser
        });
    }
});

// API Routes

// Get membership data
router.get('/api/data/:walletAddress?', membershipController.getMembershipData);

// Update membership after transaction
router.post('/api/update', 
    transactionLimiter,
    sanitizeInput,
    membershipController.updateMembership
);

// Refresh membership data from blockchain
router.post('/api/refresh', async (req, res) => {
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

// Exit membership
router.post('/api/exit', 
    transactionLimiter,
    sanitizeInput,
    async (req, res) => {
        try {
            if (!req.user || !req.user.walletAddress) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { transactionHash } = req.body;
            
            if (!transactionHash) {
                return res.status(400).json({ error: 'Transaction hash required' });
            }

            // Verify transaction
            const tx = await web3Service.provider.getTransaction(transactionHash);
            if (!tx || !tx.blockNumber) {
                return res.status(400).json({ error: 'Invalid transaction' });
            }

            // Update membership status
            const membership = await Membership.findOne({
                walletAddress: req.user.walletAddress.toLowerCase(),
                isActive: true
            });

            if (membership) {
                membership.isActive = false;
                membership.exitTransactionHash = transactionHash;
                membership.exitedAt = new Date();
                await membership.save();
            }

            res.json({
                success: true,
                message: 'Membership exited successfully'
            });
        } catch (error) {
            console.error('Exit membership error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;