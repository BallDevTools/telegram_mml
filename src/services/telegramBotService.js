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

    // Keyboard Creators
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