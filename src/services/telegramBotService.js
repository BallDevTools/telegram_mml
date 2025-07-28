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

    // Command Handlers
    async handleStart(msg, match) {
        const chatId = msg.chat.id;
        const telegramUser = msg.from;
        const startParam = match[1].trim();

        try {
            // Create or update user
            let user = await this.createOrUpdateUser(telegramUser);

            // Handle referral
            if (startParam.startsWith('ref_')) {
                await this.handleReferralCode(user, startParam);
            }

            const keyboard = this.createStartKeyboard();
            const welcomeMessage = this.getWelcomeMessage(user);

            await this.bot.sendMessage(chatId, welcomeMessage, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });

        } catch (error) {
            console.error('Start command error:', error);
            await this.sendErrorMessage(chatId);
        }
    }

    async handlePlans(msg) {
        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            return this.bot.sendMessage(chatId, 'กรุณาใช้คำสั่ง /start ก่อน');
        }

        try {
            const plans = await this.getPlansData();
            const keyboard = this.createPlansKeyboard();

            await this.bot.sendMessage(chatId,
                this.formatPlansMessage(plans), {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Plans command error:', error);
            await this.sendErrorMessage(chatId);
        }
    }

    async handleDashboard(msg) {
        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user || !user.walletAddress) {
            return this.sendWalletRequiredMessage(chatId);
        }

        try {
            const membership = await Membership.findOne({
                walletAddress: user.walletAddress,
                isActive: true
            });

            if (!membership) {
                return this.sendNoMembershipMessage(chatId);
            }

            const dashboardData = await this.getDashboardData(user);
            const keyboard = this.createDashboardKeyboard();

            await this.bot.sendMessage(chatId,
                this.formatDashboardMessage(dashboardData), {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Dashboard command error:', error);
            await this.sendErrorMessage(chatId);
        }
    }

    async handleWallet(msg) {
        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            return this.bot.sendMessage(chatId, 'กรุณาใช้คำสั่ง /start ก่อน');
        }

        const keyboard = user.walletAddress ?
            this.createWalletConnectedKeyboard() :
            this.createWalletKeyboard();

        const message = user.walletAddress ?
            this.formatWalletConnectedMessage(user) :
            this.getWalletConnectMessage();

        await this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    async handleRefer(msg) {
        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            return this.bot.sendMessage(chatId, 'กรุณาใช้คำสั่ง /start ก่อน');
        }

        try {
            const referralData = await this.getReferralData(user);
            const referralLink = this.generateReferralLink(user);
            const keyboard = this.createReferralKeyboard(referralLink);

            await this.bot.sendMessage(chatId,
                this.formatReferralMessage(referralData, referralLink), {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Refer command error:', error);
            await this.sendErrorMessage(chatId);
        }
    }

    async handleStats(msg) {
        const chatId = msg.chat.id;

        try {
            const systemStats = await web3Service.getSystemStats();
            const message = this.formatStatsMessage(systemStats);

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Stats command error:', error);
            await this.sendErrorMessage(chatId);
        }
    }

    async handleHelp(msg) {
        const chatId = msg.chat.id;
        const helpMessage = this.getHelpMessage();
        const keyboard = this.createHelpKeyboard();

        await this.bot.sendMessage(chatId, helpMessage, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    async handleSupport(msg) {
        const chatId = msg.chat.id;
        const supportMessage = this.getSupportMessage();
        const keyboard = this.createSupportKeyboard();

        await this.bot.sendMessage(chatId, supportMessage, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    // Callback Query Handler
    async handleCallbackQuery(callbackQuery) {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg.chat.id;

        // Answer callback query to remove loading state
        await this.bot.answerCallbackQuery(callbackQuery.id);

        switch (data) {
            case 'open_app':
                await this.sendAppLink(chatId);
                break;
            case 'view_plans':
                await this.handlePlans(msg);
                break;
            case 'connect_wallet':
                await this.sendWalletConnectLink(chatId);
                break;
            case 'refresh_data':
                await this.handleDashboard(msg);
                break;
            case 'share_referral':
                await this.handleShareReferral(callbackQuery);
                break;
            default:
                if (data.startsWith('plan_')) {
                    await this.handlePlanSelection(callbackQuery, data);
                }
        }
    }

    // Message fallback handler
    async handleMessage(msg) {
        // Skip if it's a command
        if (msg.text && msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const user = await this.getUser(msg.from.id);

        if (!user) {
            await this.bot.sendMessage(chatId,
                '👋 สวัสดีครับ! ใช้คำสั่ง /start เพื่อเริ่มใช้งาน Crypto Membership NFT'
            );
        }
    }
    // แก้ไขใน src/services/telegramBotService.js
    // เพิ่มฟังก์ชันที่หายไปในคลาส TelegramBotService

    // เพิ่มในส่วน Method ของคลาส TelegramBotService
    async sendWalletConnectLink(chatId) {
        const message = `💳 <b>Connect Your Wallet</b>\n\n` +
            `เชื่อมต่อ Wallet เพื่อเข้าใช้งานระบบ\n\n` +
            `📱 <b>Supported Wallets:</b>\n` +
            `• MetaMask\n` +
            `• Trust Wallet\n` +
            `• WalletConnect\n` +
            `• Binance Chain Wallet`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔗 Connect Wallet', web_app: { url: `${this.appUrl}/wallet/connect` } }],
                [{ text: '❓ How to Connect', callback_data: 'wallet_help' }],
                [{ text: '🏠 Back to Home', callback_data: 'start' }]
            ]
        };

        try {
            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending wallet connect link:', error);
            await this.bot.sendMessage(chatId, 'กรุณาลองใหม่อีกครั้ง');
        }
    }

    async sendAppLink(chatId) {
        const message = `🚀 <b>Open Crypto Membership App</b>\n\n` +
            `เปิดแอพเพื่อเข้าใช้งานระบบเต็มรูปแบบ`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🚀 Open App', web_app: { url: this.appUrl } }]
            ]
        };

        try {
            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending app link:', error);
            await this.bot.sendMessage(chatId, 'กรุณาลองใหม่อีกครั้ง');
        }
    }

    async handleShareReferral(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const user = await this.getUser(callbackQuery.from.id);

        if (!user) {
            await this.bot.sendMessage(chatId, 'กรุณาใช้คำสั่ง /start ก่อน');
            return;
        }

        const referralLink = this.generateReferralLink(user);
        const shareMessage = `🚀 มาร่วม Crypto Membership NFT กันเถอะ!\n\n` +
            `💎 ระบบสมาชิกภาพแบบ Decentralized\n` +
            `🎨 รับ NFT สุดพิเศษ\n` +
            `💰 หารายได้จากการแนะนำเพื่อน\n\n` +
            `👇 คลิกลิงก์นี้เพื่อเริ่มต้น:\n${referralLink}`;

        try {
            // ส่งข้อความพร้อมปุ่มแชร์
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📤 Share to Friends', switch_inline_query: shareMessage }],
                    [{ text: '📋 Copy Link', callback_data: 'copy_referral' }]
                ]
            };

            await this.bot.sendMessage(chatId, `🔗 <b>Your Referral Link:</b>\n\n<code>${referralLink}</code>\n\n💡 แชร์ลิงก์นี้เพื่อรับ Commission`, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error handling share referral:', error);
            await this.bot.sendMessage(chatId, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
    }

    async handlePlanSelection(callbackQuery, data) {
        const chatId = callbackQuery.message.chat.id;
        const planId = data.replace('plan_', '');

        const message = `📋 <b>Plan ${planId} Selected</b>\n\n` +
            `กรุณาเชื่อมต่อ Wallet เพื่อทำการซื้อ`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 Connect Wallet', web_app: { url: `${this.appUrl}/wallet/connect` } }],
                [{ text: '📋 View All Plans', web_app: { url: `${this.appUrl}/membership/plans` } }]
            ]
        };

        try {
            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error handling plan selection:', error);
            await this.bot.sendMessage(chatId, 'กรุณาลองใหม่อีกครั้ง');
        }
    }

    // เพิ่มฟังก์ชันสำหรับ help keyboards ที่หายไป
    createHelpKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '📖 User Guide', web_app: { url: `${this.appUrl}/how-it-works` } }],
                [
                    { text: '💬 Support Chat', url: 'https://t.me/your_support_group' },
                    { text: '📧 Contact', url: 'mailto:support@example.com' }
                ],
                [{ text: '🏠 Back to Home', callback_data: 'start' }]
            ]
        };
    }

    createSupportKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '💬 Live Support', url: 'https://t.me/your_support_username' }],
                [{ text: '📖 FAQ', web_app: { url: `${this.appUrl}/support` } }],
                [{ text: '📧 Email Support', url: 'mailto:support@example.com' }],
                [{ text: '🏠 Back to Home', callback_data: 'start' }]
            ]
        };
    }

    createWalletConnectedKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '📊 Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                [{ text: '💳 Wallet Details', web_app: { url: `${this.appUrl}/wallet/dashboard` } }],
                [{ text: '🔄 Disconnect', callback_data: 'disconnect_wallet' }]
            ]
        };
    }

    // เพิ่มฟังก์ชันสำหรับ message formatters ที่หายไป
    getWalletConnectMessage() {
        return `💳 <b>Connect Your Wallet</b>\n\n` +
            `เชื่อมต่อ Wallet เพื่อ:\n` +
            `• ซื้อ Membership NFT\n` +
            `• รับ Commission จากการแนะนำ\n` +
            `• ติดตามรายได้\n` +
            `• อัพเกรดระดับสมาชิก\n\n` +
            `🔒 <i>ปลอดภัย 100% - เราไม่เก็บ Private Key ของคุณ</i>`;
    }

    formatWalletConnectedMessage(user) {
        const address = user.walletAddress;
        const shortAddress = `${address.substring(0, 6)}...${address.substring(38)}`;

        return `✅ <b>Wallet Connected</b>\n\n` +
            `📍 Address: <code>${shortAddress}</code>\n` +
            `🌐 Network: BSC (Binance Smart Chain)\n\n` +
            `🎯 พร้อมใช้งานระบบแล้ว!`;
    }

    getHelpMessage() {
        return `❓ <b>How can we help you?</b>\n\n` +
            `📖 <b>Quick Start Guide:</b>\n` +
            `1. Connect your wallet\n` +
            `2. Choose a membership plan\n` +
            `3. Get your NFT\n` +
            `4. Share referral link\n` +
            `5. Earn commissions!\n\n` +
            `💡 <i>Need more help? Contact our support team</i>`;
    }

    getSupportMessage() {
        return `🆘 <b>Support & Help</b>\n\n` +
            `We're here to help you 24/7!\n\n` +
            `🕐 <b>Response Time:</b> Usually within 1 hour\n` +
            `💬 <b>Live Chat:</b> Available\n` +
            `📧 <b>Email:</b> Available\n\n` +
            `📱 Choose your preferred contact method below:`;
    }

    // เพิ่มฟังก์ชันสำหรับการจัดการข้อมูลต่างๆ
    async getPlansData() {
        // ถ้ามี web3Service ให้เรียกใช้ได้
        try {
            const web3Service = require('./web3Service');
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

            return plans;
        } catch (error) {
            // Fallback data ถ้า web3Service ไม่พร้อม
            return [
                { id: 1, name: 'Starter', priceUSDT: '1' },
                { id: 2, name: 'Basic', priceUSDT: '2' },
                { id: 3, name: 'Bronze', priceUSDT: '3' },
                { id: 4, name: 'Silver', priceUSDT: '4' },
                { id: 5, name: 'Gold', priceUSDT: '5' }
            ];
        }
    }

    async getDashboardData(user) {
        try {
            // ดึงข้อมูล membership จาก database
            const Membership = require('../models/Membership');
            const membership = await Membership.findOne({
                walletAddress: user.walletAddress,
                isActive: true
            });

            return {
                membership,
                user,
                hasWallet: !!user.walletAddress
            };
        } catch (error) {
            console.error('Error getting dashboard data:', error);
            return { membership: null, user, hasWallet: false };
        }
    }

    async getReferralData(user) {
        try {
            const User = require('../models/User');
            const referrals = await User.find({
                referredBy: user._id
            }).select('firstName lastName username createdAt');

            return {
                totalReferrals: referrals.length,
                referrals: referrals,
                referralLink: this.generateReferralLink(user)
            };
        } catch (error) {
            console.error('Error getting referral data:', error);
            return {
                totalReferrals: 0,
                referrals: [],
                referralLink: this.generateReferralLink(user)
            };
        }
    }

    formatStatsMessage(systemStats) {
        return `📈 <b>System Statistics</b>\n\n` +
            `👥 Total Members: <b>${parseInt(systemStats.totalMembers)}</b>\n` +
            `💰 Total Revenue: <b>${(parseInt(systemStats.totalRevenue) / 1000000).toFixed(0)} USDT</b>\n` +
            `🎯 Total Plans: <b>16</b>\n` +
            `🔗 Network: <b>BSC</b>\n\n` +
            `📊 <i>Updated: ${new Date().toLocaleString()}</i>`;
    }

    formatReferralMessage(referralData, referralLink) {
        return `🔗 <b>Your Referral Program</b>\n\n` +
            `👥 Total Referrals: <b>${referralData.totalReferrals}</b>\n` +
            `💰 Earn up to 60% commission!\n\n` +
            `📱 <b>Your Referral Link:</b>\n` +
            `<code>${referralLink}</code>\n\n` +
            `💡 <i>Share this link to earn commissions when friends join!</i>`;
    }

    formatDashboardMessage(dashboardData) {
        const { membership, user, hasWallet } = dashboardData;

        if (!hasWallet) {
            return `📊 <b>Dashboard</b>\n\n` +
                `⚠️ Please connect your wallet first to view your dashboard`;
        }

        if (!membership) {
            return `📊 <b>Dashboard</b>\n\n` +
                `🎯 Ready to start! Choose a membership plan to begin earning`;
        }

        const earnings = (parseInt(membership.totalEarnings) / 1000000).toFixed(2);

        return `📊 <b>Your Dashboard</b>\n\n` +
            `🎨 Plan: <b>${membership.planName}</b> (Level ${membership.planId})\n` +
            `💰 Total Earnings: <b>${earnings} USDT</b>\n` +
            `👥 Referrals: <b>${membership.totalReferrals}</b>\n` +
            `🔄 Cycle: <b>#${membership.cycleNumber}</b>\n\n` +
            `🚀 <i>Keep growing your network!</i>`;
    }
    
    createStartKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '🚀 เปิดแอพ', web_app: { url: this.appUrl } }],
                [
                    { text: '📋 ดูแผน', callback_data: 'view_plans' },
                    { text: '💳 เชื่อม Wallet', callback_data: 'connect_wallet' }
                ],
                [{ text: '🔗 รับลิงก์แนะนำ', callback_data: 'get_referral' }]
            ]
        };
    }

    createPlansKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '🚀 เลือกแผนใน App', web_app: { url: `${this.appUrl}/membership/plans` } }],
                [{ text: '🏠 กลับหน้าหลัก', callback_data: 'start' }]
            ]
        };
    }

    createDashboardKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '📊 เปิด Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                [
                    { text: '🔄 อัพเดท', callback_data: 'refresh_data' },
                    { text: '🔗 แชร์', callback_data: 'share_referral' }
                ]
            ]
        };
    }

    createWalletKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '💳 เชื่อม Wallet', web_app: { url: `${this.appUrl}/wallet/connect` } }],
                [{ text: '❓ วิธีเชื่อม Wallet', callback_data: 'wallet_help' }]
            ]
        };
    }

    createReferralKeyboard(referralLink) {
        return {
            inline_keyboard: [
                [{ text: '📤 แชร์ลิงก์', switch_inline_query: `🚀 มาร่วม Crypto Membership NFT กันเถอะ! ${referralLink}` }],
                [{ text: '📋 คัดลอกลิงก์', callback_data: 'copy_referral' }],
                [{ text: '📊 ดูสถิติการแนะนำ', web_app: { url: `${this.appUrl}/membership/dashboard` } }]
            ]
        };
    }

    // Helper Methods
    async createOrUpdateUser(telegramUser) {
        let user = await User.findOne({ telegramId: telegramUser.id.toString() });

        if (!user) {
            user = new User({
                telegramId: telegramUser.id.toString(),
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
                username: telegramUser.username,
                languageCode: telegramUser.language_code || 'en'
            });
            await user.save();
        } else {
            user.firstName = telegramUser.first_name;
            user.lastName = telegramUser.last_name;
            user.username = telegramUser.username;
            user.lastActive = new Date();
            await user.save();
        }

        return user;
    }

    async getUser(telegramId) {
        return await User.findOne({ telegramId: telegramId.toString() });
    }

    generateReferralLink(user) {
        return `https://t.me/${this.botUsername}/app?startapp=ref_${user.referralCode}`;
    }

    // Message Formatters
    getWelcomeMessage(user) {
        return `🎉 <b>ยินดีต้อนรับสู่ Crypto Membership NFT!</b>

👋 สวัสดี <b>${user.firstName}</b>

🚀 <b>เริ่มต้นการเดินทางในระบบ Membership แบบ Decentralized</b>

💎 <b>คุณสมบัติพิเศษ:</b>
• 16 ระดับสมาชิกภาพ ($1 - $16)
• รับ NFT เฉพาะของแต่ละระดับ
• ระบบแนะนำเพื่อนรับ Commission
• อัพเกรดระดับเพื่อประโยชน์เพิ่มเติม

📱 <b>กดปุ่มด้านล่างเพื่อเริ่มใช้งาน!</b>`;
    }

    formatPlansMessage(plans) {
        let message = `📋 <b>แผนสมาชิกภาพทั้งหมด</b>\n\n`;

        plans.slice(0, 5).forEach((plan, index) => {
            const emoji = this.getPlanEmoji(plan.id);
            message += `${emoji} <b>${plan.name}</b> - $${plan.priceUSDT} USDT\n`;
            message += `   Level ${plan.id} | Cycle: ${plan.currentCycle}\n\n`;
        });

        message += `💡 <i>รวม 16 ระดับ - เริ่มต้นที่ $1 เท่านั้น!</i>`;
        return message;
    }

    getPlanEmoji(planId) {
        if (planId <= 4) return '🌟';
        if (planId <= 8) return '💎';
        if (planId <= 12) return '👑';
        return '🔥';
    }

    // Notification Methods
    async notifyNewReferral(userId, referralName, planName) {
        try {
            const message = `🎉 <b>มีคนใช้ลิงก์แนะนำของคุณ!</b>

👤 <b>${referralName}</b> เข้าร่วมระบบแล้ว
📋 เมื่อซื้อ <b>${planName}</b> คุณจะได้รับ Commission

💰 <i>ติดตามรายได้ใน Dashboard</i>`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📊 ดู Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }]
                ]
            };

            await this.bot.sendMessage(userId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending referral notification:', error);
        }
    }

    async notifyCommissionReceived(userId, amount, fromUser, planName) {
        try {
            const message = `💰 <b>รับ Commission แล้ว!</b>

💵 <b>+${amount} USDT</b>
👤 จาก: <b>${fromUser}</b>
📋 แผน: <b>${planName}</b>

🎉 <i>Commission ถูกส่งไป Wallet ของคุณแล้ว!</i>`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '💳 ดู Wallet', web_app: { url: `${this.appUrl}/wallet/dashboard` } }]
                ]
            };

            await this.bot.sendMessage(userId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending commission notification:', error);
        }
    }

    async notifyUpgradeSuccess(userId, oldPlan, newPlan) {
        try {
            const message = `🎊 <b>อัพเกรดสำเร็จ!</b>

⬆️ <b>${oldPlan} → ${newPlan}</b>
🎨 NFT ใหม่ได้ถูก mint แล้ว
💰 อัตรา Commission เพิ่มขึ้น!

🚀 <i>ยินดีด้วยกับระดับใหม่!</i>`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📊 ดู Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }]
                ]
            };

            await this.bot.sendMessage(userId, message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error sending upgrade notification:', error);
        }
    }

    // Error handlers
    async sendErrorMessage(chatId) {
        await this.bot.sendMessage(chatId,
            '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง หรือติดต่อ Support');
    }

    async sendWalletRequiredMessage(chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 เชื่อม Wallet', web_app: { url: `${this.appUrl}/wallet/connect` } }]
            ]
        };

        await this.bot.sendMessage(chatId,
            '💳 <b>จำเป็นต้องเชื่อม Wallet ก่อน</b>\n\nกรุณาเชื่อม Wallet เพื่อใช้งานคุณสมบัตินี้', {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }

    async sendNoMembershipMessage(chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📋 เลือกแผน', web_app: { url: `${this.appUrl}/membership/plans` } }]
            ]
        };

        await this.bot.sendMessage(chatId,
            '🎯 <b>ยังไม่มีสมาชิกภาพ</b>\n\nกรุณาเลือกแผนสมาชิกภาพเพื่อเริ่มใช้งาน', {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
}

module.exports = new TelegramBotService();