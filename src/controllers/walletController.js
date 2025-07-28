// src/controllers/walletController.js - Fixed version
const User = require('../models/User');
const Membership = require('../models/Membership');
const web3Service = require('../services/web3Service');
const { ethers } = require('ethers');

const walletController = {
    // Show wallet connection page
    async showConnect(req, res) {
        try {
            // Check if user already has wallet connected
            if (req.user && req.user.walletAddress) {
                return res.redirect('/wallet/dashboard');
            }

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

            // ไม่ใช้ layout('layouts/main') แต่ render แบบ standalone
            res.render('pages/wallet-connect', {
                title: 'Connect Wallet',
                supportedWallets,
                telegramUser: req.telegramUser,
                user: req.user
            });
        } catch (error) {
            console.error('Wallet connect page error:', error);
            res.status(500).render('error', {
                message: 'Error loading wallet connection page',
                telegramUser: req.telegramUser,
                layout: false
            });
        }
    },

    // Show wallet dashboard
    async showDashboard(req, res) {
        try {
            if (!req.user || !req.user.walletAddress) {
                return res.redirect('/wallet/connect');
            }

            // Get membership info
            const membership = await Membership.findOne({
                walletAddress: req.user.walletAddress,
                isActive: true
            });

            // Get wallet balances
            let walletBalance = {
                bnb: '0',
                usdt: '0'
            };

            try {
                // Get BNB balance
                const bnbBalance = await web3Service.provider.getBalance(req.user.walletAddress);
                walletBalance.bnb = ethers.utils.formatEther(bnbBalance);

                // Get USDT balance
                const usdtContract = new ethers.Contract(
                    process.env.USDT_CONTRACT_ADDRESS,
                    ['function balanceOf(address) view returns (uint256)'],
                    web3Service.provider
                );
                const usdtBalance = await usdtContract.balanceOf(req.user.walletAddress);
                walletBalance.usdt = ethers.utils.formatUnits(usdtBalance, 6);
            } catch (error) {
                console.error('Error fetching wallet balance:', error);
            }

            // Get transaction history
            const transactions = await this.getTransactionHistory(req.user.walletAddress);

            res.render('pages/wallet-dashboard', {
                title: 'Wallet Dashboard',
                membership,
                walletBalance,
                transactions,
                telegramUser: req.telegramUser,
                user: req.user,
                layout: false // ไม่ใช้ layout
            });
        } catch (error) {
            console.error('Wallet dashboard error:', error);
            res.status(500).render('error', {
                message: 'Error loading wallet dashboard',
                telegramUser: req.telegramUser,
                layout: false
            });
        }
    },

    // Connect wallet API
    async connectWallet(req, res) {
        try {
            const { walletAddress, signature, message } = req.body;

            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!walletAddress) {
                return res.status(400).json({ error: 'Wallet address required' });
            }

            // Validate Ethereum address format
            if (!ethers.utils.isAddress(walletAddress)) {
                return res.status(400).json({ error: 'Invalid wallet address format' });
            }

            // Verify signature if provided
            if (signature && message) {
                try {
                    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
                    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                        return res.status(400).json({ error: 'Signature verification failed' });
                    }
                } catch (error) {
                    return res.status(400).json({ error: 'Invalid signature' });
                }
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

            // Get wallet balances
            let walletBalance = { bnb: '0', usdt: '0' };
            try {
                const bnbBalance = await web3Service.provider.getBalance(walletAddress);
                walletBalance.bnb = ethers.utils.formatEther(bnbBalance);

                const usdtContract = new ethers.Contract(
                    process.env.USDT_CONTRACT_ADDRESS,
                    ['function balanceOf(address) view returns (uint256)'],
                    web3Service.provider
                );
                const usdtBalance = await usdtContract.balanceOf(walletAddress);
                walletBalance.usdt = ethers.utils.formatUnits(usdtBalance, 6);
            } catch (error) {
                console.error('Error fetching balance:', error);
            }

            res.json({
                success: true,
                walletAddress: walletAddress.toLowerCase(),
                hasMembership: !!membership,
                membership: membership,
                balance: walletBalance
            });
        } catch (error) {
            console.error('Wallet connect error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Disconnect wallet API
    async disconnectWallet(req, res) {
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
    },

    // Get wallet info API
    async getWalletInfo(req, res) {
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
                    const bnbBalance = await web3Service.provider.getBalance(req.user.walletAddress);
                    const usdtContract = new ethers.Contract(
                        process.env.USDT_CONTRACT_ADDRESS,
                        ['function balanceOf(address) view returns (uint256)'],
                        web3Service.provider
                    );
                    const usdtBalance = await usdtContract.balanceOf(req.user.walletAddress);

                    walletInfo.balance = {
                        bnb: ethers.utils.formatEther(bnbBalance),
                        usdt: ethers.utils.formatUnits(usdtBalance, 6)
                    };
                } catch (error) {
                    console.error('Error fetching balance:', error);
                    walletInfo.balance = { bnb: '0', usdt: '0' };
                }
            }

            res.json(walletInfo);
        } catch (error) {
            console.error('Wallet info error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Verify wallet ownership
    async verifyWallet(req, res) {
        try {
            const { walletAddress, message, signature } = req.body;

            if (!walletAddress || !message || !signature) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Verify signature
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
    },

    // Get transaction history
    async getTransactionHistory(walletAddress) {
        try {
            // Get membership transactions from database
            const memberships = await Membership.find({
                walletAddress: walletAddress.toLowerCase()
            }).sort({ createdAt: -1 });

            const transactions = memberships.map(membership => ({
                type: 'membership',
                hash: membership.transactionHash,
                planId: membership.planId,
                planName: membership.planName,
                amount: membership.planPrice || '0',
                timestamp: membership.createdAt,
                status: membership.isActive ? 'confirmed' : 'inactive'
            }));

            return transactions;
        } catch (error) {
            console.error('Error getting transaction history:', error);
            return [];
        }
    },

    // Show transaction history page
    async showTransactions(req, res) {
        try {
            if (!req.user || !req.user.walletAddress) {
                return res.redirect('/wallet/connect');
            }

            const transactions = await this.getTransactionHistory(req.user.walletAddress);

            res.render('pages/transactions', {
                title: 'Transaction History',
                transactions,
                telegramUser: req.telegramUser,
                user: req.user,
                layout: false
            });
        } catch (error) {
            console.error('Transactions page error:', error);
            res.status(500).render('error', {
                message: 'Error loading transactions',
                telegramUser: req.telegramUser,
                layout: false
            });
        }
    },

    // Get supported wallets
    async getSupportedWallets(req, res) {
        try {
            const supportedWallets = [
                {
                    name: 'MetaMask',
                    id: 'metamask',
                    icon: '🦊',
                    description: 'Popular browser extension wallet',
                    downloadUrl: 'https://metamask.io',
                    deepLink: 'https://metamask.app.link/dapp/',
                    mobile: true,
                    desktop: true,
                    instructions: 'Install MetaMask extension or mobile app and create a wallet'
                },
                {
                    name: 'Trust Wallet',
                    id: 'trust',
                    icon: '🛡️',
                    description: 'Secure mobile wallet',
                    downloadUrl: 'https://trustwallet.com',
                    deepLink: 'https://link.trustwallet.com/open_url?coin_id=20000714&url=',
                    mobile: true,
                    desktop: false,
                    instructions: 'Download Trust Wallet app from App Store or Google Play'
                },
                {
                    name: 'WalletConnect',
                    id: 'walletconnect',
                    icon: '🔗',
                    description: 'Connect any wallet',
                    downloadUrl: 'https://walletconnect.org',
                    mobile: true,
                    desktop: true,
                    instructions: 'Scan QR code with any WalletConnect compatible wallet'
                },
                {
                    name: 'Binance Chain Wallet',
                    id: 'binance',
                    icon: '🟡',
                    description: 'Official Binance wallet',
                    downloadUrl: 'https://www.binance.org/en/smartChain',
                    mobile: true,
                    desktop: true,
                    instructions: 'Install Binance Chain Wallet extension or use Binance app'
                }
            ];

            res.json(supportedWallets);
        } catch (error) {
            console.error('Error getting supported wallets:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Generate wallet connection message
    async generateConnectionMessage(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const message = `Connect wallet to Crypto Membership NFT\n\nUser ID: ${req.user.telegramId}\nTimestamp: ${Date.now()}`;
            const nonce = Math.random().toString(36).substring(7);

            // Store nonce in session for verification
            req.session.walletNonce = nonce;

            res.json({
                message: message,
                nonce: nonce
            });
        } catch (error) {
            console.error('Error generating connection message:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Check wallet balance
    async checkBalance(req, res) {
        try {
            const { walletAddress } = req.params;

            if (!ethers.utils.isAddress(walletAddress)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }

            // Get BNB balance
            const bnbBalance = await web3Service.provider.getBalance(walletAddress);
            
            // Get USDT balance
            const usdtContract = new ethers.Contract(
                process.env.USDT_CONTRACT_ADDRESS,
                ['function balanceOf(address) view returns (uint256)'],
                web3Service.provider
            );
            const usdtBalance = await usdtContract.balanceOf(walletAddress);

            const balances = {
                bnb: {
                    raw: bnbBalance.toString(),
                    formatted: ethers.utils.formatEther(bnbBalance),
                    symbol: 'BNB'
                },
                usdt: {
                    raw: usdtBalance.toString(),
                    formatted: ethers.utils.formatUnits(usdtBalance, 6),
                    symbol: 'USDT'
                }
            };

            res.json({
                address: walletAddress,
                balances: balances,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error checking balance:', error);
            res.status(500).json({ error: 'Error checking wallet balance' });
        }
    },

    // Import wallet from private key (for testing/admin)
    async importWallet(req, res) {
        try {
            const { privateKey } = req.body;

            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!privateKey) {
                return res.status(400).json({ error: 'Private key required' });
            }

            // Only allow in development
            if (process.env.NODE_ENV !== 'development') {
                return res.status(403).json({ error: 'Feature only available in development' });
            }

            try {
                const wallet = new ethers.Wallet(privateKey);
                const walletAddress = wallet.address;

                // Check if wallet already connected
                const existingUser = await User.findOne({
                    walletAddress: walletAddress.toLowerCase(),
                    telegramId: { $ne: req.user.telegramId }
                });

                if (existingUser) {
                    return res.status(400).json({ 
                        error: 'Wallet already connected to another account' 
                    });
                }

                // Connect wallet
                req.user.walletAddress = walletAddress.toLowerCase();
                await req.user.save();

                res.json({
                    success: true,
                    walletAddress: walletAddress.toLowerCase(),
                    message: 'Wallet imported successfully'
                });
            } catch (error) {
                return res.status(400).json({ error: 'Invalid private key' });
            }
        } catch (error) {
            console.error('Wallet import error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = walletController;