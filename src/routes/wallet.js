// src/routes/wallet.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Membership = require('../models/Membership');
const { sanitizeInput } = require('../middleware/security');

// Show wallet connection page
router.get('/connect', (req, res) => {
    res.render('pages/wallet-connect', {
        title: 'Connect Wallet',
        telegramUser: req.telegramUser,
        user: req.user
    });
});

// Show wallet dashboard
router.get('/dashboard', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.redirect('/wallet/connect');
        }

        // Get membership info
        const membership = await Membership.findOne({
            walletAddress: req.user.walletAddress,
            isActive: true
        });

        // Get wallet balance (if available)
        let walletBalance = null;
        try {
            const web3Service = require('../services/web3Service');
            walletBalance = await web3Service.getWalletBalance(req.user.walletAddress);
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
        }

        res.render('pages/wallet-dashboard', {
            title: 'Wallet Dashboard',
            membership,
            walletBalance,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Wallet dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading wallet dashboard',
            telegramUser: req.telegramUser
        });
    }
});

// API: Connect wallet
router.post('/api/connect', sanitizeInput, async (req, res) => {
    try {
        const { walletAddress, signature } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        // Validate Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address format' });
        }

        // Check if wallet is already connected to another account
        const existingUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase(),
            telegramId: { $ne: req.user.telegramId }
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Wallet already connected to another account' 
            });
        }

        // Update user with wallet address
        req.user.walletAddress = walletAddress.toLowerCase();
        await req.user.save();

        // Check if user has existing membership
        const membership = await Membership.findOne({
            walletAddress: walletAddress.toLowerCase(),
            isActive: true
        });

        res.json({
            success: true,
            walletAddress: walletAddress.toLowerCase(),
            hasMembership: !!membership,
            membership: membership
        });
    } catch (error) {
        console.error('Wallet connect error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Disconnect wallet
router.post('/api/disconnect', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Remove wallet address from user
        req.user.walletAddress = undefined;
        await req.user.save();

        res.json({
            success: true,
            message: 'Wallet disconnected successfully'
        });
    } catch (error) {
        console.error('Wallet disconnect error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Get wallet info
router.get('/api/info', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const walletInfo = {
            connected: !!req.user.walletAddress,
            address: req.user.walletAddress || null,
            membership: null,
            balance: null
        };

        if (req.user.walletAddress) {
            // Get membership info
            walletInfo.membership = await Membership.findOne({
                walletAddress: req.user.walletAddress,
                isActive: true
            });

            // Get wallet balance
            try {
                const web3Service = require('../services/web3Service');
                walletInfo.balance = await web3Service.getWalletBalance(req.user.walletAddress);
            } catch (error) {
                console.error('Error fetching balance:', error);
            }
        }

        res.json(walletInfo);
    } catch (error) {
        console.error('Wallet info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Verify wallet ownership
router.post('/api/verify', sanitizeInput, async (req, res) => {
    try {
        const { walletAddress, message, signature } = req.body;

        if (!walletAddress || !message || !signature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify signature
        const { ethers } = require('ethers');
        try {
            const recoveredAddress = ethers.utils.verifyMessage(message, signature);
            
            if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                return res.status(400).json({ error: 'Invalid signature' });
            }

            res.json({
                success: true,
                verified: true,
                address: recoveredAddress.toLowerCase()
            });
        } catch (error) {
            res.status(400).json({ error: 'Signature verification failed' });
        }
    } catch (error) {
        console.error('Wallet verify error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Get supported wallets
router.get('/api/supported', (req, res) => {
    const supportedWallets = [
        {
            name: 'MetaMask',
            id: 'metamask',
            icon: '🦊',
            description: 'Popular browser extension wallet',
            downloadUrl: 'https://metamask.io',
            deepLink: 'https://metamask.app.link/dapp/',
            mobile: true,
            desktop: true
        },
        {
            name: 'Trust Wallet',
            id: 'trust',
            icon: '🛡️',
            description: 'Secure mobile wallet',
            downloadUrl: 'https://trustwallet.com',
            deepLink: 'https://link.trustwallet.com/open_url?coin_id=20000714&url=',
            mobile: true,
            desktop: false
        },
        {
            name: 'WalletConnect',
            id: 'walletconnect',
            icon: '🔗',
            description: 'Connect any wallet',
            downloadUrl: 'https://walletconnect.org',
            mobile: true,
            desktop: true
        },
        {
            name: 'Binance Chain Wallet',
            id: 'binance',
            icon: '🟡',
            description: 'Official Binance wallet',
            downloadUrl: 'https://www.binance.org/en/smartChain',
            mobile: true,
            desktop: true
        }
    ];

    res.json(supportedWallets);
});

// Show transaction history
router.get('/transactions', async (req, res) => {
    try {
        if (!req.user || !req.user.walletAddress) {
            return res.redirect('/wallet/connect');
        }

        // Get user's memberships and transactions
        const memberships = await Membership.find({
            walletAddress: req.user.walletAddress
        }).sort({ createdAt: -1 });

        res.render('pages/transactions', {
            title: 'Transaction History',
            memberships,
            telegramUser: req.telegramUser,
            user: req.user
        });
    } catch (error) {
        console.error('Transactions page error:', error);
        res.status(500).render('error', {
            message: 'Error loading transactions',
            telegramUser: req.telegramUser
        });
    }
});

module.exports = router;