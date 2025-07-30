// src/services/telegramBotService.js - Enhanced Version
const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const Membership = require('../models/Membership');
const web3Service = require('./web3Service');

class TelegramBotService {
    constructor() {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN not found');
            return;
        }

        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
            polling: true,
            baseApiUrl: 'https://api.telegram.org'
        });

        this.appUrl = process.env.APP_URL || 'https://your-app.com';
        this.botUsername = process.env.TELEGRAM_BOT_USERNAME;

        this.setupCommands();
        this.setupHandlers();
        this.setupErrorHandling();

        console.log('🤖 Telegram Bot Service initialized');
    }

    setupCommands() {
        // Set bot commands menu
        this.bot.setMyCommands([
            { command: 'start', description: '🚀 เริ่มใช้งาน Crypto Membership' },
            { command: 'plans', description: '📋 ดูแผนสมาชิกภาพทั้งหมด' },
            { command: 'dashboard', description: '📊 ดู Dashboard ของคุณ' },
            { command: 'wallet', description: '💳 จัดการ Wallet' },
            { command: 'refer', description: '🔗 รับลิงก์แนะนำเพื่อน' },
            { command: 'stats', description: '📈 สถิติระบบ' },
            { command: 'help', description: '❓ ความช่วยเหลือ' },
            { command: 'support', description: '🆘 ติดต่อฝ่ายสนับสนุน' }
        ]);
    }

    setupHandlers() {
        // /start command with referral handling
        this.bot.onText(/\/start(.*)/, this.handleStart.bind(this));
        // Individual commands
        this.bot.onText(/\/plans/, this.handlePlans.bind(this));
        this.bot.onText(/\/dashboard/, this.handleDashboard.bind(this));
        this.bot.onText(/\/wallet/, this.handleWallet.bind(this));
        this.bot.onText(/\/refer/, this.handleRefer.bind(this));
        this.bot.onText(/\/stats/, this.handleStats.bind(this));
        this.bot.onText(/\/help/, this.handleHelp.bind(this));
        this.bot.onText(/\/support/, this.handleSupport.bind(this));
        // Callback query handlers (for inline keyboards)
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        // Handle any message (for fallback)
        this.bot.on('message', this.handleMessage.bind(this));
    }

    setupErrorHandling() {
        this.bot.on('error', (error) => {
            console.error('❌ Bot Error:', error);
        });
        this.bot.on('polling_error', (error) => {
            console.error('❌ Polling Error:', error);
        });
    }

    // Enhanced /wallet command with direct connection options
    async handleWallet(msg) {
        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            return this.bot.sendMessage(chatId, 'กรุณาใช้คำสั่ง /start ก่อน');
        }

        if (user.walletAddress) {
            // If wallet already connected
            const keyboard = this.createConnectedWalletKeyboard();
            const message = this.formatWalletConnectedMessage(user);
            
            return await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        }

        // If wallet not connected - show direct connection options
        const keyboard = this.createDirectWalletConnectionKeyboard();
        const message = this.getDirectWalletConnectionMessage();

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    createDirectWalletConnectionKeyboard() {
        return {
            inline_keyboard: [
                // Direct Deep Links to Wallet Apps
                [
                    { 
                        text: '🦊 MetaMask', 
                        url: `https://metamask.app.link/dapp/${process.env.APP_URL}/wallet/connect?telegram=${this.generateTelegramToken()}`
                    }
                ],
                [
                    { 
                        text: '🛡️ Trust Wallet', 
                        url: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(process.env.APP_URL + '/wallet/connect?telegram=' + this.generateTelegramToken())}`
                    }
                ],
                [
                    { 
                        text: '🟡 Binance Wallet', 
                        url: `https://www.binance.org/en/bridge?url=${encodeURIComponent(process.env.APP_URL + '/wallet/connect?telegram=' + this.generateTelegramToken())}`
                    }
                ],
                // QR Code option for desktop wallets
                [
                    { text: '📱 Show QR Code', callback_data: 'show_wallet_qr' }
                ],
                // Manual address input option
                [
                    { text: '✏️ Manual Input', callback_data: 'manual_wallet_input' }
                ],
                // Mini App fallback
                [
                    { text: '🌐 Open in Browser', web_app: { url: `${this.appUrl}/wallet/connect` } }
                ]
            ]
        };
    }

    getDirectWalletConnectionMessage() {
        return `💳 <b>Connect Your Wallet</b>\n\n` +
               `🚀 <b>Quick Connect Options:</b>\n\n` +
               `📱 <b>Mobile Wallets:</b>\n` +
               `• Tap wallet button to open app directly\n` +
               `• Your wallet app will handle the connection\n\n` +
               `🖥️ <b>Desktop:</b>\n` +
               `• Use QR Code to scan with mobile wallet\n` +
               `• Or manually input your wallet address\n\n` +
               `🔒 <i>Your private keys stay in your wallet - 100% secure!</i>`;
    }

    // Generate secure token for Telegram user verification
    generateTelegramToken(user) {
        const crypto = require('crypto');
        const data = {
            userId: user?.telegramId || 'anonymous',
            timestamp: Date.now(),
            nonce: Math.random().toString(36)
        };
        
        return crypto
            .createHmac('sha256', process.env.SESSION_SECRET || 'default')
            .update(JSON.stringify(data))
            .digest('hex');
    }

    // Handle callback queries for wallet connection
    async handleWalletCallbacks(callbackQuery) {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg.chat.id;
        const user = await this.getUser(callbackQuery.from.id);

        await this.bot.answerCallbackQuery(callbackQuery.id);

        switch (data) {
            case 'show_wallet_qr':
                await this.sendWalletQRCode(chatId, user);
                break;
                
            case 'manual_wallet_input':
                await this.promptManualWalletInput(chatId, user);
                break;
                
            case 'refresh_wallet_status':
                await this.checkWalletConnectionStatus(chatId, user);
                break;
        }
    }

    // Send QR Code for desktop wallet connection
    async sendWalletQRCode(chatId, user) {
        try {
            const connectionUrl = `${this.appUrl}/wallet/connect?telegram=${this.generateTelegramToken(user)}`;
            
            // Generate QR Code
            const QRCode = require('qrcode');
            const qrBuffer = await QRCode.toBuffer(connectionUrl, {
                errorCorrectionLevel: 'M',
                type: 'png',
                quality: 0.92,
                margin: 1,
                width: 256
            });

            const message = `📱 <b>Scan QR Code with Your Wallet</b>\n\n` +
                           `1. Open your wallet app\n` +
                           `2. Go to "Scan QR" or "WalletConnect"\n` +
                           `3. Scan this code\n` +
                           `4. Approve the connection\n\n` +
                           `⏰ <i>QR Code expires in 5 minutes</i>`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Generate New QR', callback_data: 'show_wallet_qr' }],
                    [{ text: '✅ Check Connection', callback_data: 'refresh_wallet_status' }]
                ]
            };

            await this.bot.sendPhoto(chatId, qrBuffer, {
                caption: message,
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });

        } catch (error) {
            console.error('Error generating QR code:', error);
            await this.bot.sendMessage(chatId, '❌ Error generating QR code. Please try manual input.');
        }
    }

    // Prompt for manual wallet address input
    async promptManualWalletInput(chatId, user) {
        const message = `✏️ <b>Manual Wallet Address Input</b>\n\n` +
                       `Please send your wallet address in the next message.\n\n` +
                       `📋 <b>Format:</b> 0x1234...abcd\n` +
                       `🔒 <b>Security:</b> Only send your PUBLIC address, never private keys!\n\n` +
                       `⚠️ <b>Note:</b> You'll need to sign a message to verify ownership.`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'cancel_manual_input' }]
            ]
        };

        // Set user state for next message handling
        user.awaitingWalletAddress = true;
        await user.save();

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    // Handle manual wallet address input
    async handleManualWalletInput(msg) {
        const chatId = msg.chat.id;
        const walletAddress = msg.text.trim();
        const user = await this.getUser(msg.from.id);

        // Validate Ethereum address format
        const { ethers } = require('ethers');
        if (!ethers.utils.isAddress(walletAddress)) {
            await this.bot.sendMessage(chatId, 
                '❌ Invalid wallet address format. Please send a valid Ethereum address (0x...)');
            return;
        }

        // Check if address is already connected
        const User = require('../models/User');
        const existingUser = await User.findOne({
            walletAddress: walletAddress.toLowerCase(),
            telegramId: { $ne: user.telegramId }
        });

        if (existingUser) {
            await this.bot.sendMessage(chatId, 
                '⚠️ This wallet is already connected to another account.');
            return;
        }

        // Generate signature message
        const signatureMessage = `Connect wallet to Crypto Membership NFT\n\nUser: ${user.telegramId}\nTime: ${Date.now()}\nNonce: ${Math.random().toString(36)}`;
        
        const message = `🔐 <b>Verify Wallet Ownership</b>\n\n` +
                       `Address: <code>${walletAddress}</code>\n\n` +
                       `📝 <b>Please sign this message in your wallet:</b>\n` +
                       `<code>${signatureMessage}</code>\n\n` +
                       `⚡ <b>Then send signature here or use wallet app connection.</b>`;

        const keyboard = {
            inline_keyboard: [
                [
                    { 
                        text: '🦊 Sign in MetaMask', 
                        url: `https://metamask.app.link/send/?address=${walletAddress}&message=${encodeURIComponent(signatureMessage)}`
                    }
                ],
                [
                    { text: '✅ I signed, connect wallet', callback_data: `verify_wallet_${walletAddress}` }
                ],
                [
                    { text: '❌ Cancel', callback_data: 'cancel_manual_input' }
                ]
            ]
        };

        // Clear awaiting state
        user.awaitingWalletAddress = false;
        
        // Store signature data temporarily
        user.pendingWalletAddress = walletAddress.toLowerCase();
        user.pendingSignatureMessage = signatureMessage;
        await user.save();

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    // Check wallet connection status
    async checkWalletConnectionStatus(chatId, user) {
        // Refresh user data
        const User = require('../models/User');
        const refreshedUser = await User.findById(user._id);

        if (refreshedUser.walletAddress) {
            const message = `✅ <b>Wallet Connected Successfully!</b>\n\n` +
                           `📍 Address: <code>${refreshedUser.walletAddress}</code>\n` +
                           `🎯 You can now use all features of the system!`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📊 Open Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                    [{ text: '📋 View Plans', callback_data: 'view_plans' }]
                ]
            };

            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } else {
            await this.bot.sendMessage(chatId, 
                '⏳ Wallet not connected yet. Please complete the connection process.');
        }
    }

    // Enhanced message handler to catch manual wallet input
    async handleMessage(msg) {
        // Skip commands
        if (msg.text && msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            await this.bot.sendMessage(chatId,
                '👋 สวัสดีครับ! ใช้คำสั่ง /start เพื่อเริ่มใช้งาน Crypto Membership NFT'
            );
            return;
        }

        // Handle manual wallet address input
        if (user.awaitingWalletAddress) {
            await this.handleManualWalletInput(msg);
            return;
        }

        // Handle signature input (if user sends signature directly)
        if (msg.text && msg.text.startsWith('0x') && msg.text.length > 100) {
            await this.handleSignatureInput(msg);
            return;
        }

        // Default fallback
        const keyboard = {
            inline_keyboard: [
                [{ text: '🚀 Open App', web_app: { url: this.appUrl } }],
                [{ text: '📋 View Commands', callback_data: 'show_commands' }]
            ]
        };

        await this.bot.sendMessage(chatId,
            '💡 Use /wallet to connect your wallet or /help to see all commands', {
            reply_markup: keyboard
        });
    }

    // Handle signature verification
    async handleSignatureInput(msg) {
        const chatId = msg.chat.id;
        const signature = msg.text.trim();
        const user = await this.getUser(msg.from.id);

        if (!user.pendingWalletAddress || !user.pendingSignatureMessage) {
            await this.bot.sendMessage(chatId, 
                '❌ No pending wallet verification. Please start the wallet connection process again.');
            return;
        }

        try {
            const { ethers } = require('ethers');
            const recoveredAddress = ethers.utils.verifyMessage(
                user.pendingSignatureMessage, 
                signature
            );

            if (recoveredAddress.toLowerCase() === user.pendingWalletAddress) {
                // Successfully verified - connect wallet
                user.walletAddress = user.pendingWalletAddress;
                user.pendingWalletAddress = undefined;
                user.pendingSignatureMessage = undefined;
                await user.save();

                const message = `🎉 <b>Wallet Connected Successfully!</b>\n\n` +
                               `📍 Address: <code>${user.walletAddress}</code>\n` +
                               `✅ Signature verified\n\n` +
                               `🎯 You can now use all features!`;

                const keyboard = {
                    inline_keyboard: [
                        [{ text: '📊 Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                        [{ text: '📋 View Plans', callback_data: 'view_plans' }]
                    ]
                };

                await this.bot.sendMessage(chatId, message, {
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                });

            } else {
                await this.bot.sendMessage(chatId, 
                    '❌ Signature verification failed. Please make sure you signed the correct message with the correct wallet.');
            }

        } catch (error) {
            console.error('Signature verification error:', error);
            await this.bot.sendMessage(chatId, 
                '❌ Invalid signature format. Please try again or use the wallet app connection.');
        }
    }

    // Create keyboard for connected wallet
    createConnectedWalletKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '📊 Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                [
                    { text: '💰 Balance', callback_data: 'check_balance' },
                    { text: '📋 Plans', callback_data: 'view_plans' }
                ],
                [
                    { text: '🔄 Refresh', callback_data: 'refresh_wallet_status' },
                    { text: '🔓 Disconnect', callback_data: 'disconnect_wallet' }
                ]
            ]
        };
    }
}

module.exports = new TelegramBotService();