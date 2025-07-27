// src/services/telegramBotService.js
const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');

class TelegramBotService {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.setupCommands();
    }
    
    setupCommands() {
        // Set bot commands
        this.bot.setMyCommands([
            { command: 'start', description: 'Start using the bot' },
            { command: 'plans', description: 'View membership plans' },
            { command: 'dashboard', description: 'View your dashboard' },
            { command: 'refer', description: 'Get your referral link' },
            { command: 'help', description: 'Get help' }
        ]);
        
        // Handle /start command
        this.bot.onText(/\/start(.*)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const telegramUser = msg.from;
            const startParam = match[1].trim();
            
            try {
                // Create or update user
                let user = await User.findOne({ telegramId: telegramUser.id.toString() });
                if (!user) {
                    user = new User({
                        telegramId: telegramUser.id.toString(),
                        firstName: telegramUser.first_name,
                        lastName: telegramUser.last_name,
                        username: telegramUser.username,
                        languageCode: telegramUser.language_code
                    });
                    
                    // Handle referral
                    if (startParam.startsWith('ref_')) {
                        const referralCode = startParam.replace('ref_', '');
                        const referrer = await User.findOne({ referralCode });
                        if (referrer) {
                            user.referredBy = referrer._id;
                        }
                    }
                    
                    await user.save();
                }
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🚀 Open App', web_app: { url: `${process.env.APP_URL}` } }],
                        [
                            { text: '📋 View Plans', web_app: { url: `${process.env.APP_URL}/membership/plans` } },
                            { text: '📊 Dashboard', web_app: { url: `${process.env.APP_URL}/membership/dashboard` } }
                        ]
                    ]
                };
                
                await this.bot.sendMessage(chatId, 
                    `🎉 Welcome to Crypto Membership NFT!\n\n` +
                    `Start your journey in the decentralized membership ecosystem.\n\n` +
                    `💎 16 Membership Levels\n` +
                    `🔗 Referral System\n` +
                    `🎨 Exclusive NFTs\n` +
                    `💰 Earn Commissions\n\n` +
                    `Click "Open App" to get started!`,
                    { reply_markup: keyboard }
                );
                
            } catch (error) {
                console.error('Start command error:', error);
                await this.bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
            }
        });
        
        // Handle /plans command
        this.bot.onText(/\/plans/, async (msg) => {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 View All Plans', web_app: { url: `${process.env.APP_URL}/membership/plans` } }]
                ]
            };
            
            await this.bot.sendMessage(msg.chat.id,
                `🚀 Choose from 16 membership levels:\n\n` +
                `🌟 Starter (Level 1) - 1 USDT\n` +
                `💎 Premium Levels (2-12)\n` +
                `👑 Elite Levels (13-16)\n\n` +
                `Each level unlocks new benefits and earning opportunities!`,
                { reply_markup: keyboard }
            );
        });
        
        // Handle /dashboard command
        this.bot.onText(/\/dashboard/, async (msg) => {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📊 Open Dashboard', web_app: { url: `${process.env.APP_URL}/membership/dashboard` } }]
                ]
            };
            
            await this.bot.sendMessage(msg.chat.id,
                `📊 View your membership dashboard:\n\n` +
                `• Current plan and level\n` +
                `• Earnings and commissions\n` +
                `• Referral statistics\n` +
                `• NFT collection\n\n` +
                `Track your progress and earnings!`,
                { reply_markup: keyboard }
            );
        });
        
        // Handle /refer command
        this.bot.onText(/\/refer/, async (msg) => {
            try {
                const user = await User.findOne({ telegramId: msg.from.id.toString() });
                if (!user) {
                    await this.bot.sendMessage(msg.chat.id, 'Please start the bot first with /start');
                    return;
                }
                
                const referralLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}/app?startapp=ref_${user.referralCode}`;
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔗 Share Link', switch_inline_query: `Join Crypto Membership NFT! ${referralLink}` }]
                    ]
                };
                
                await this.bot.sendMessage(msg.chat.id,
                    `🔗 Your Referral Link:\n\n` +
                    `${referralLink}\n\n` +
                    `💰 Earn commissions for each referral!\n` +
                    `👥 Build your network and grow your earnings\n\n` +
                    `Share with friends and family!`,
                    { reply_markup: keyboard }
                );
                
            } catch (error) {
                console.error('Refer command error:', error);
                await this.bot.sendMessage(msg.chat.id, 'Error generating referral link.');
            }
        });
        
        // Handle /help command
        this.bot.onText(/\/help/, async (msg) => {
            await this.bot.sendMessage(msg.chat.id,
                `🤖 Crypto Membership NFT Bot Help\n\n` +
                `Commands:\n` +
                `/start - Start using the bot\n` +
                `/plans - View membership plans\n` +
                `/dashboard - Your personal dashboard\n` +
                `/refer - Get your referral link\n` +
                `/help - Show this help message\n\n` +
                `💡 How it works:\n` +
                `1. Choose a membership plan\n` +
                `2. Connect your wallet\n` +
                `3. Register with USDT payment\n` +
                `4. Receive your NFT membership\n` +
                `5. Refer friends and earn commissions\n\n` +
                `Need support? Contact @support`
            );
        });
    }
    
    async sendNotification(userId, message, options = {}) {
        try {
            await this.bot.sendMessage(userId, message, options);
        } catch (error) {
            console.error('Notification error:', error);
        }
    }
    
    async notifyUpgrade(userId, planName, level) {
        const message = `🎉 Congratulations!\n\nYou've successfully upgraded to ${planName} (Level ${level})!\n\nYour new NFT has been minted and your earning potential has increased.`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '📊 View Dashboard', web_app: { url: `${process.env.APP_URL}/membership/dashboard` } }]
            ]
        };
        
        await this.sendNotification(userId, message, { reply_markup: keyboard });
    }
    
    async notifyReferralJoined(userId, referralName) {
        const message = `👥 Great news!\n\n${referralName} has joined using your referral link!\n\nYou'll receive commission when they register for a membership plan.`;
        
        await this.sendNotification(userId, message);
    }
}

module.exports = new TelegramBotService();