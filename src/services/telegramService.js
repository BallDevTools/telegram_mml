// src/services/telegramService.js - Telegram API wrapper
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.webhookUrl = process.env.WEBHOOK_URL;
        this.webhookSecret = process.env.WEBHOOK_SECRET;
        this.appUrl = process.env.APP_URL || 'https://localhost:3000';
        this.botUsername = process.env.TELEGRAM_BOT_USERNAME;
        
        if (!this.botToken) {
            console.warn('⚠️ TELEGRAM_BOT_TOKEN not found, Telegram service disabled');
            this.bot = null;
            return;
        }

        try {
            this.bot = new TelegramBot(this.botToken, {
                polling: false, // We'll handle this separately
                baseApiUrl: 'https://api.telegram.org'
            });
            
            console.log('📱 Telegram Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Telegram bot:', error);
            this.bot = null;
        }
    }

    // Bot Configuration Methods
    async setWebhook(url, options = {}) {
        if (!this.bot) return false;
        
        try {
            const webhookOptions = {
                url: url,
                allowed_updates: ['message', 'callback_query', 'my_chat_member'],
                drop_pending_updates: true,
                ...options
            };

            if (this.webhookSecret) {
                webhookOptions.secret_token = this.webhookSecret;
            }

            const result = await this.bot.setWebHook(webhookOptions.url, webhookOptions);
            console.log('🎣 Webhook set successfully:', url);
            return result;
        } catch (error) {
            console.error('❌ Error setting webhook:', error);
            return false;
        }
    }

    async deleteWebhook() {
        if (!this.bot) return false;
        
        try {
            const result = await this.bot.deleteWebHook();
            console.log('🗑️ Webhook deleted successfully');
            return result;
        } catch (error) {
            console.error('❌ Error deleting webhook:', error);
            return false;
        }
    }

    async getWebhookInfo() {
        if (!this.bot) return null;
        
        try {
            const info = await this.bot.getWebHookInfo();
            return {
                url: info.url,
                hasCustomCertificate: info.has_custom_certificate,
                pendingUpdateCount: info.pending_update_count,
                lastErrorDate: info.last_error_date,
                lastErrorMessage: info.last_error_message,
                maxConnections: info.max_connections,
                allowedUpdates: info.allowed_updates
            };
        } catch (error) {
            console.error('❌ Error getting webhook info:', error);
            return null;
        }
    }

    async setBotCommands() {
        if (!this.bot) return false;
        
        try {
            const commands = [
                { command: 'start', description: '🚀 Start using Crypto Membership' },
                { command: 'plans', description: '📋 View all membership plans' },
                { command: 'dashboard', description: '📊 View your dashboard' },
                { command: 'wallet', description: '💳 Manage your wallet' },
                { command: 'refer', description: '🔗 Get your referral link' },
                { command: 'stats', description: '📈 System statistics' },
                { command: 'help', description: '❓ Get help' },
                { command: 'support', description: '🆘 Contact support' }
            ];

            const result = await this.bot.setMyCommands(commands);
            console.log('⚙️ Bot commands set successfully');
            return result;
        } catch (error) {
            console.error('❌ Error setting bot commands:', error);
            return false;
        }
    }

    // Message Sending Methods
    async sendMessage(chatId, text, options = {}) {
        if (!this.bot) {
            console.warn('Bot not initialized, cannot send message');
            return null;
        }

        try {
            const defaultOptions = {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            };

            const result = await this.bot.sendMessage(chatId, text, {
                ...defaultOptions,
                ...options
            });

            return result;
        } catch (error) {
            console.error('❌ Error sending message:', error);
            this.handleBotError(error, chatId);
            return null;
        }
    }

    async sendPhoto(chatId, photo, options = {}) {
        if (!this.bot) return null;

        try {
            const result = await this.bot.sendPhoto(chatId, photo, options);
            return result;
        } catch (error) {
            console.error('❌ Error sending photo:', error);
            this.handleBotError(error, chatId);
            return null;
        }
    }

    async sendDocument(chatId, document, options = {}) {
        if (!this.bot) return null;

        try {
            const result = await this.bot.sendDocument(chatId, document, options);
            return result;
        } catch (error) {
            console.error('❌ Error sending document:', error);
            this.handleBotError(error, chatId);
            return null;
        }
    }

    async editMessage(chatId, messageId, text, options = {}) {
        if (!this.bot) return null;

        try {
            const defaultOptions = {
                parse_mode: 'HTML'
            };

            const result = await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...defaultOptions,
                ...options
            });

            return result;
        } catch (error) {
            console.error('❌ Error editing message:', error);
            return null;
        }
    }

    async deleteMessage(chatId, messageId) {
        if (!this.bot) return false;

        try {
            const result = await this.bot.deleteMessage(chatId, messageId);
            return result;
        } catch (error) {
            console.error('❌ Error deleting message:', error);
            return false;
        }
    }

    // Inline Keyboard Helpers
    createInlineKeyboard(buttons) {
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    createWebAppButton(text, url) {
        return { text, web_app: { url } };
    }

    createUrlButton(text, url) {
        return { text, url };
    }

    createCallbackButton(text, callback_data) {
        return { text, callback_data };
    }

    // Pre-built Keyboards
    getMainKeyboard() {
        return this.createInlineKeyboard([
            [this.createWebAppButton('🚀 Open App', this.appUrl)],
            [
                this.createCallbackButton('📋 View Plans', 'view_plans'),
                this.createCallbackButton('💳 Connect Wallet', 'connect_wallet')
            ],
            [this.createCallbackButton('🔗 Get Referral Link', 'get_referral')]
        ]);
    }

    getPlansKeyboard() {
        return this.createInlineKeyboard([
            [this.createWebAppButton('🚀 Choose Plan in App', `${this.appUrl}/membership/plans`)],
            [this.createCallbackButton('🏠 Back to Home', 'start')]
        ]);
    }

    getDashboardKeyboard() {
        return this.createInlineKeyboard([
            [this.createWebAppButton('📊 Open Dashboard', `${this.appUrl}/membership/dashboard`)],
            [
                this.createCallbackButton('🔄 Refresh', 'refresh_data'),
                this.createCallbackButton('🔗 Share', 'share_referral')
            ]
        ]);
    }

    getWalletKeyboard() {
        return this.createInlineKeyboard([
            [this.createWebAppButton('💳 Connect Wallet', `${this.appUrl}/wallet/connect`)],
            [this.createCallbackButton('❓ How to Connect', 'wallet_help')]
        ]);
    }

    getHelpKeyboard() {
        return this.createInlineKeyboard([
            [this.createWebAppButton('📖 User Guide', `${this.appUrl}/how-it-works`)],
            [
                this.createUrlButton('💬 Support Chat', 'https://t.me/your_support_group'),
                this.createUrlButton('📧 Email', 'mailto:support@example.com')
            ],
            [this.createCallbackButton('🏠 Back to Home', 'start')]
        ]);
    }

    // Message Templates
    getWelcomeMessage(user) {
        return `🎉 <b>Welcome to Crypto Membership NFT!</b>

👋 Hello <b>${user.firstName}</b>

🚀 <b>Start your journey in the Decentralized Membership System</b>

💎 <b>Special Features:</b>
• 16 membership levels ($1 - $16)
• Unique NFT for each level
• Referral system with commissions
• Upgrade path for additional benefits

📱 <b>Click the button below to get started!</b>`;
    }

    getPlansMessage(plans) {
        let message = `📋 <b>All Membership Plans</b>\n\n`;
        
        plans.slice(0, 5).forEach(plan => {
            const emoji = this.getPlanEmoji(plan.id);
            message += `${emoji} <b>${plan.name}</b> - $${plan.priceUSDT} USDT\n`;
            message += `   Level ${plan.id} | Cycle: ${plan.currentCycle}\n\n`;
        });
        
        message += `💡 <i>Total 16 levels - starting from just $1!</i>`;
        return message;
    }

    getDashboardMessage(data) {
        const { membership, user, hasWallet } = data;

        if (!hasWallet) {
            return `📊 <b>Dashboard</b>\n\n⚠️ Please connect your wallet first to view your dashboard`;
        }

        if (!membership) {
            return `📊 <b>Dashboard</b>\n\n🎯 Ready to start! Choose a membership plan to begin earning`;
        }

        const earnings = (parseInt(membership.totalEarnings) / 1000000).toFixed(2);

        return `📊 <b>Your Dashboard</b>\n\n` +
               `🎨 Plan: <b>${membership.planName}</b> (Level ${membership.planId})\n` +
               `💰 Total Earnings: <b>${earnings} USDT</b>\n` +
               `👥 Referrals: <b>${membership.totalReferrals}</b>\n` +
               `🔄 Cycle: <b>#${membership.cycleNumber}</b>\n\n` +
               `🚀 <i>Keep growing your network!</i>`;
    }

    getWalletConnectMessage() {
        return `💳 <b>Connect Your Wallet</b>\n\n` +
               `Connect your wallet to:\n` +
               `• Buy Membership NFTs\n` +
               `• Receive referral commissions\n` +
               `• Track your earnings\n` +
               `• Upgrade membership levels\n\n` +
               `🔒 <i>100% secure - we never store your private keys</i>`;
    }

    getReferralMessage(data) {
        return `🔗 <b>Your Referral Program</b>\n\n` +
               `👥 Total Referrals: <b>${data.totalReferrals}</b>\n` +
               `💰 Earn up to 60% commission!\n\n` +
               `📱 <b>Your Referral Link:</b>\n` +
               `<code>${data.referralLink}</code>\n\n` +
               `💡 <i>Share this link to earn commissions when friends join!</i>`;
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

    getStatsMessage(systemStats) {
        return `📈 <b>System Statistics</b>\n\n` +
               `👥 Total Members: <b>${parseInt(systemStats.totalMembers)}</b>\n` +
               `💰 Total Revenue: <b>${(parseInt(systemStats.totalRevenue) / 1000000).toFixed(0)} USDT</b>\n` +
               `🎯 Total Plans: <b>16</b>\n` +
               `🔗 Network: <b>BSC</b>\n\n` +
               `📊 <i>Updated: ${new Date().toLocaleString()}</i>`;
    }

    // Notification Templates
    getNewReferralNotification(referralName, planName) {
        return `🎉 <b>Someone used your referral link!</b>\n\n` +
               `👤 <b>${referralName}</b> joined the system\n` +
               `📋 When they purchase <b>${planName}</b>, you'll receive commission\n\n` +
               `💰 <i>Track your earnings in the Dashboard</i>`;
    }

    getCommissionReceivedNotification(amount, fromUser, planName) {
        return `💰 <b>Commission Received!</b>\n\n` +
               `💵 <b>+${amount} USDT</b>\n` +
               `👤 From: <b>${fromUser}</b>\n` +
               `📋 Plan: <b>${planName}</b>\n\n` +
               `🎉 <i>Commission has been sent to your wallet!</i>`;
    }

    getUpgradeSuccessNotification(oldPlan, newPlan) {
        return `🎊 <b>Upgrade Successful!</b>\n\n` +
               `⬆️ <b>${oldPlan} → ${newPlan}</b>\n` +
               `🎨 New NFT has been minted\n` +
               `💰 Commission rate increased!\n\n` +
               `🚀 <i>Congratulations on your new level!</i>`;
    }

    // Utility Methods
    validateWebhookData(initData, secretToken = null) {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            
            if (!hash) return null;
            
            urlParams.delete('hash');
            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            
            const secretKey = crypto
                .createHmac('sha256', 'WebAppData')
                .update(this.botToken)
                .digest();
            
            const calculatedHash = crypto
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');
            
            if (calculatedHash === hash) {
                const authDate = parseInt(urlParams.get('auth_date'));
                const currentTime = Math.floor(Date.now() / 1000);
                
                if (currentTime - authDate < 86400) {
                    const userParam = urlParams.get('user');
                    return userParam ? JSON.parse(userParam) : null;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Webhook validation error:', error);
            return null;
        }
    }

    generateReferralLink(userCode) {
        if (!this.botUsername) {
            return `${this.appUrl}?ref=${userCode}`;
        }
        return `https://t.me/${this.botUsername}/app?startapp=ref_${userCode}`;
    }

    getPlanEmoji(planId) {
        if (planId <= 4) return '🌟';
        if (planId <= 8) return '💎';
        if (planId <= 12) return '👑';
        return '🔥';
    }

    // User Information Methods
    async getUserInfo(userId) {
        if (!this.bot) return null;

        try {
            const user = await this.bot.getChat(userId);
            return {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                type: user.type,
                bio: user.bio,
                photo: user.photo
            };
        } catch (error) {
            console.error('❌ Error getting user info:', error);
            return null;
        }
    }

    async getChatMember(chatId, userId) {
        if (!this.bot) return null;

        try {
            const member = await this.bot.getChatMember(chatId, userId);
            return {
                status: member.status,
                user: member.user,
                joinDate: member.until_date
            };
        } catch (error) {
            console.error('❌ Error getting chat member:', error);
            return null;
        }
    }

    // File and Media Methods
    async getFile(fileId) {
        if (!this.bot) return null;

        try {
            const file = await this.bot.getFile(fileId);
            return {
                fileId: file.file_id,
                fileUniqueId: file.file_unique_id,
                fileSize: file.file_size,
                filePath: file.file_path,
                downloadUrl: `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`
            };
        } catch (error) {
            console.error('❌ Error getting file:', error);
            return null;
        }
    }

    async downloadFile(fileId, destination) {
        if (!this.bot) return false;

        try {
            const file = await this.getFile(fileId);
            if (!file) return false;

            const response = await fetch(file.downloadUrl);
            const buffer = await response.arrayBuffer();
            
            require('fs').writeFileSync(destination, Buffer.from(buffer));
            return true;
        } catch (error) {
            console.error('❌ Error downloading file:', error);
            return false;
        }
    }

    // Callback Query Methods
    async answerCallbackQuery(queryId, options = {}) {
        if (!this.bot) return false;

        try {
            const result = await this.bot.answerCallbackQuery(queryId, options);
            return result;
        } catch (error) {
            console.error('❌ Error answering callback query:', error);
            return false;
        }
    }

    // Bulk Operations
    async sendBulkMessage(chatIds, text, options = {}) {
        if (!this.bot) return { sent: 0, failed: 0 };

        const results = { sent: 0, failed: 0 };
        const delay = options.delay || 100; // Delay between messages to avoid rate limits

        for (const chatId of chatIds) {
            try {
                await this.sendMessage(chatId, text, options);
                results.sent++;
            } catch (error) {
                console.error(`Failed to send message to ${chatId}:`, error);
                results.failed++;
            }

            // Add delay between messages
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }

    async sendNotificationToAdmins(message, adminIds = []) {
        if (!this.bot) return false;

        const admins = adminIds.length > 0 ? adminIds : [process.env.ADMIN_TELEGRAM_ID].filter(Boolean);
        
        if (admins.length === 0) {
            console.warn('No admin IDs configured for notifications');
            return false;
        }

        const results = await this.sendBulkMessage(admins, message, {
            parse_mode: 'HTML'
        });

        console.log(`📢 Admin notification sent: ${results.sent} successful, ${results.failed} failed`);
        return results.sent > 0;
    }

    // Error Handling
    handleBotError(error, chatId = null) {
        const errorCode = error.response?.body?.error_code;
        const description = error.response?.body?.description;

        switch (errorCode) {
            case 403:
                console.warn(`Bot blocked by user ${chatId}`);
                break;
            case 400:
                console.warn(`Bad request: ${description}`);
                break;
            case 429:
                console.warn('Rate limit exceeded, backing off...');
                break;
            case 502:
            case 503:
            case 504:
                console.warn('Telegram server error, will retry...');
                break;
            default:
                console.error('Telegram API error:', error.message);
        }
    }

    // Rate Limiting
    async withRateLimit(operation, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (error.response?.body?.error_code === 429) {
                    const retryAfter = error.response.body.parameters?.retry_after || 1;
                    console.warn(`Rate limited, waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Max retries exceeded');
    }

    // Analytics Helpers
    formatUserMention(user) {
        if (user.username) {
            return `@${user.username}`;
        }
        return `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
    }

    formatCurrency(amount, currency = 'USDT') {
        return `${parseFloat(amount).toFixed(2)} ${currency}`;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Bot Status Methods
    async getBotInfo() {
        if (!this.bot) return null;

        try {
            const me = await this.bot.getMe();
            return {
                id: me.id,
                isBot: me.is_bot,
                firstName: me.first_name,
                username: me.username,
                canJoinGroups: me.can_join_groups,
                canReadAllGroupMessages: me.can_read_all_group_messages,
                supportsInlineQueries: me.supports_inline_queries
            };
        } catch (error) {
            console.error('❌ Error getting bot info:', error);
            return null;
        }
    }

    async getBotCommands() {
        if (!this.bot) return [];

        try {
            const commands = await this.bot.getMyCommands();
            return commands;
        } catch (error) {
            console.error('❌ Error getting bot commands:', error);
            return [];
        }
    }

    // Health Check
    async healthCheck() {
        if (!this.bot) {
            return {
                status: 'disabled',
                reason: 'Bot token not configured',
                timestamp: new Date().toISOString()
            };
        }

        try {
            const botInfo = await this.getBotInfo();
            const webhookInfo = await this.getWebhookInfo();

            return {
                status: 'healthy',
                bot: {
                    id: botInfo?.id,
                    username: botInfo?.username,
                    isBot: botInfo?.isBot
                },
                webhook: {
                    url: webhookInfo?.url || 'Not set',
                    pendingUpdates: webhookInfo?.pendingUpdateCount || 0
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Cleanup and Maintenance
    async cleanupOldMessages(chatId, olderThan = 7) {
        // Note: Telegram doesn't provide direct API to delete old messages
        // This would need to be implemented with message tracking
        console.warn('Message cleanup not implemented - Telegram API limitation');
        return false;
    }

    // Development Helpers
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    async sendDevelopmentNotification(message) {
        if (!this.isDevelopment()) return false;

        const devChatId = process.env.DEV_TELEGRAM_CHAT_ID;
        if (!devChatId) return false;

        return await this.sendMessage(devChatId, `🔧 <b>Development:</b>\n\n${message}`, {
            parse_mode: 'HTML'
        });
    }

    // Integration Methods
    async processWebhookUpdate(updateData) {
        try {
            if (updateData.message) {
                return {
                    type: 'message',
                    chatId: updateData.message.chat.id,
                    messageId: updateData.message.message_id,
                    user: updateData.message.from,
                    text: updateData.message.text,
                    date: new Date(updateData.message.date * 1000)
                };
            }

            if (updateData.callback_query) {
                return {
                    type: 'callback_query',
                    queryId: updateData.callback_query.id,
                    chatId: updateData.callback_query.message.chat.id,
                    messageId: updateData.callback_query.message.message_id,
                    user: updateData.callback_query.from,
                    data: updateData.callback_query.data
                };
            }

            return { type: 'unknown', data: updateData };
        } catch (error) {
            console.error('Error processing webhook update:', error);
            return null;
        }
    }

    // Export for testing
    getBot() {
        return this.bot;
    }

    isInitialized() {
        return this.bot !== null;
    }
}

module.exports = new TelegramService();