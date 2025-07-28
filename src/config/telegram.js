// src/config/telegram.js
const crypto = require('crypto');

class TelegramConfig {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.botUsername = process.env.TELEGRAM_BOT_USERNAME;
        this.appUrl = process.env.APP_URL || 'https://localhost:3000';
        this.webhookUrl = process.env.WEBHOOK_URL;
        this.webhookSecret = process.env.WEBHOOK_SECRET;
        this.adminId = process.env.ADMIN_TELEGRAM_ID;
        
        this.validateConfig();
    }

    validateConfig() {
        if (!this.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is required');
        }
        
        if (!this.botUsername) {
            console.warn('⚠️  TELEGRAM_BOT_USERNAME not set, some features may not work');
        }
    }

    // Bot configuration
    getBotConfig() {
        return {
            token: this.botToken,
            options: {
                polling: !this.webhookUrl,
                webHook: this.webhookUrl ? {
                    port: process.env.WEBHOOK_PORT || 8443,
                    host: '0.0.0.0'
                } : false,
                onlyFirstMatch: true,
                request: {
                    agentOptions: {
                        keepAlive: true,
                        family: 4
                    }
                }
            }
        };
    }

    // Commands configuration
    getCommands() {
        return [
            { command: 'start', description: '🚀 เริ่มใช้งาน Crypto Membership' },
            { command: 'plans', description: '📋 ดูแผนสมาชิกภาพทั้งหมด' },
            { command: 'dashboard', description: '📊 ดู Dashboard ของคุณ' },
            { command: 'wallet', description: '💳 จัดการ Wallet' },
            { command: 'refer', description: '🔗 รับลิงก์แนะนำเพื่อน' },
            { command: 'stats', description: '📈 สถิติระบบ' },
            { command: 'help', description: '❓ ความช่วยเหลือ' },
            { command: 'support', description: '🆘 ติดต่อฝ่ายสนับสนุน' }
        ];
    }

    // Web App configuration
    getWebAppConfig() {
        return {
            url: this.appUrl,
            title: 'Crypto Membership NFT',
            description: 'Decentralized Membership System',
            shortName: 'CryptoMML'
        };
    }

    // Inline keyboard configurations
    getKeyboards() {
        return {
            start: {
                inline_keyboard: [
                    [{ text: '🚀 เปิดแอพ', web_app: { url: this.appUrl } }],
                    [
                        { text: '📋 ดูแผน', callback_data: 'view_plans' },
                        { text: '💳 เชื่อม Wallet', callback_data: 'connect_wallet' }
                    ],
                    [{ text: '🔗 รับลิงก์แนะนำ', callback_data: 'get_referral' }]
                ]
            },
            
            plans: {
                inline_keyboard: [
                    [{ text: '🚀 เลือกแผนใน App', web_app: { url: `${this.appUrl}/membership/plans` } }],
                    [{ text: '🏠 กลับหน้าหลัก', callback_data: 'start' }]
                ]
            },
            
            dashboard: {
                inline_keyboard: [
                    [{ text: '📊 เปิด Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                    [
                        { text: '🔄 อัพเดท', callback_data: 'refresh_data' },
                        { text: '🔗 แชร์', callback_data: 'share_referral' }
                    ]
                ]
            },
            
            wallet: {
                inline_keyboard: [
                    [{ text: '💳 เชื่อม Wallet', web_app: { url: `${this.appUrl}/wallet/connect` } }],
                    [{ text: '❓ วิธีเชื่อม Wallet', callback_data: 'wallet_help' }]
                ]
            },
            
            walletConnected: {
                inline_keyboard: [
                    [{ text: '📊 Dashboard', web_app: { url: `${this.appUrl}/membership/dashboard` } }],
                    [{ text: '💳 Wallet Details', web_app: { url: `${this.appUrl}/wallet/dashboard` } }],
                    [{ text: '🔄 Disconnect', callback_data: 'disconnect_wallet' }]
                ]
            },
            
            help: {
                inline_keyboard: [
                    [{ text: '📖 User Guide', web_app: { url: `${this.appUrl}/how-it-works` } }],
                    [
                        { text: '💬 Support Chat', url: 'https://t.me/your_support_group' },
                        { text: '📧 Contact', url: 'mailto:support@example.com' }
                    ],
                    [{ text: '🏠 Back to Home', callback_data: 'start' }]
                ]
            },
            
            support: {
                inline_keyboard: [
                    [{ text: '💬 Live Support', url: 'https://t.me/your_support_username' }],
                    [{ text: '📖 FAQ', web_app: { url: `${this.appUrl}/support` } }],
                    [{ text: '📧 Email Support', url: 'mailto:support@example.com' }],
                    [{ text: '🏠 Back to Home', callback_data: 'start' }]
                ]
            }
        };
    }

    // Message templates
    getMessages() {
        return {
            welcome: (user) => `🎉 <b>ยินดีต้อนรับสู่ Crypto Membership NFT!</b>

👋 สวัสดี <b>${user.firstName}</b>

🚀 <b>เริ่มต้นการเดินทางในระบบ Membership แบบ Decentralized</b>

💎 <b>คุณสมบัติพิเศษ:</b>
• 16 ระดับสมาชิกภาพ ($1 - $16)
• รับ NFT เฉพาะของแต่ละระดับ
• ระบบแนะนำเพื่อนรับ Commission
• อัพเกรดระดับเพื่อประโยชน์เพิ่มเติม

📱 <b>กดปุ่มด้านล่างเพื่อเริ่มใช้งาน!</b>`,

            plans: (plans) => {
                let message = `📋 <b>แผนสมาชิกภาพทั้งหมด</b>\n\n`;
                plans.slice(0, 5).forEach((plan) => {
                    const emoji = this.getPlanEmoji(plan.id);
                    message += `${emoji} <b>${plan.name}</b> - $${plan.priceUSDT} USDT\n`;
                    message += `   Level ${plan.id} | Cycle: ${plan.currentCycle}\n\n`;
                });
                message += `💡 <i>รวม 16 ระดับ - เริ่มต้นที่ $1 เท่านั้น!</i>`;
                return message;
            },

            dashboard: (data) => {
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
            },

            walletConnect: `💳 <b>Connect Your Wallet</b>\n\n` +
                          `เชื่อมต่อ Wallet เพื่อ:\n` +
                          `• ซื้อ Membership NFT\n` +
                          `• รับ Commission จากการแนะนำ\n` +
                          `• ติดตามรายได้\n` +
                          `• อัพเกรดระดับสมาชิก\n\n` +
                          `🔒 <i>ปลอดภัย 100% - เราไม่เก็บ Private Key ของคุณ</i>`,

            walletConnected: (user) => {
                const address = user.walletAddress;
                const shortAddress = `${address.substring(0, 6)}...${address.substring(38)}`;
                
                return `✅ <b>Wallet Connected</b>\n\n` +
                       `📍 Address: <code>${shortAddress}</code>\n` +
                       `🌐 Network: BSC (Binance Smart Chain)\n\n` +
                       `🎯 พร้อมใช้งานระบบแล้ว!`;
            },

            referral: (data) => {
                return `🔗 <b>Your Referral Program</b>\n\n` +
                       `👥 Total Referrals: <b>${data.totalReferrals}</b>\n` +
                       `💰 Earn up to 60% commission!\n\n` +
                       `📱 <b>Your Referral Link:</b>\n` +
                       `<code>${data.referralLink}</code>\n\n` +
                       `💡 <i>Share this link to earn commissions when friends join!</i>`;
            },

            help: `❓ <b>How can we help you?</b>\n\n` +
                  `📖 <b>Quick Start Guide:</b>\n` +
                  `1. Connect your wallet\n` +
                  `2. Choose a membership plan\n` +
                  `3. Get your NFT\n` +
                  `4. Share referral link\n` +
                  `5. Earn commissions!\n\n` +
                  `💡 <i>Need more help? Contact our support team</i>`,

            support: `🆘 <b>Support & Help</b>\n\n` +
                    `We're here to help you 24/7!\n\n` +
                    `🕐 <b>Response Time:</b> Usually within 1 hour\n` +
                    `💬 <b>Live Chat:</b> Available\n` +
                    `📧 <b>Email:</b> Available\n\n` +
                    `📱 Choose your preferred contact method below:`,

            stats: (systemStats) => {
                return `📈 <b>System Statistics</b>\n\n` +
                       `👥 Total Members: <b>${parseInt(systemStats.totalMembers)}</b>\n` +
                       `💰 Total Revenue: <b>${(parseInt(systemStats.totalRevenue) / 1000000).toFixed(0)} USDT</b>\n` +
                       `🎯 Total Plans: <b>16</b>\n` +
                       `🔗 Network: <b>BSC</b>\n\n` +
                       `📊 <i>Updated: ${new Date().toLocaleString()}</i>`;
            },

            // Notification templates
            newReferral: (referralName, planName) => {
                return `🎉 <b>มีคนใช้ลิงก์แนะนำของคุณ!</b>\n\n` +
                       `👤 <b>${referralName}</b> เข้าร่วมระบบแล้ว\n` +
                       `📋 เมื่อซื้อ <b>${planName}</b> คุณจะได้รับ Commission\n\n` +
                       `💰 <i>ติดตามรายได้ใน Dashboard</i>`;
            },

            commissionReceived: (amount, fromUser, planName) => {
                return `💰 <b>รับ Commission แล้ว!</b>\n\n` +
                       `💵 <b>+${amount} USDT</b>\n` +
                       `👤 จาก: <b>${fromUser}</b>\n` +
                       `📋 แผน: <b>${planName}</b>\n\n` +
                       `🎉 <i>Commission ถูกส่งไป Wallet ของคุณแล้ว!</i>`;
            },

            upgradeSuccess: (oldPlan, newPlan) => {
                return `🎊 <b>อัพเกรดสำเร็จ!</b>\n\n` +
                       `⬆️ <b>${oldPlan} → ${newPlan}</b>\n` +
                       `🎨 NFT ใหม่ได้ถูก mint แล้ว\n` +
                       `💰 อัตรา Commission เพิ่มขึ้น!\n\n` +
                       `🚀 <i>ยินดีด้วยกับระดับใหม่!</i>`;
            }
        };
    }

    // Webhook validation
    validateWebhookData(initData) {
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
                
                if (currentTime - authDate < 86400) { // 24 hours
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

    // Generate referral link
    generateReferralLink(userCode) {
        return `https://t.me/${this.botUsername}/app?startapp=ref_${userCode}`;
    }

    // Helper methods
    getPlanEmoji(planId) {
        if (planId <= 4) return '🌟';
        if (planId <= 8) return '💎';
        if (planId <= 12) return '👑';
        return '🔥';
    }

    // Rate limiting configuration
    getRateLimits() {
        return {
            commands: {
                windowMs: 60000, // 1 minute
                max: 10 // 10 commands per minute per user
            },
            callbacks: {
                windowMs: 30000, // 30 seconds
                max: 20 // 20 callbacks per 30 seconds per user
            }
        };
    }

    // Error messages
    getErrorMessages() {
        return {
            rateLimited: '⚠️ กรุณาหยุดพักสักครู่ก่อนใช้คำสั่งใหม่',
            maintenance: '🔧 ระบบกำลังปรับปรุง กรุณาลองใหม่ในภายหลัง',
            unauthorized: '⛔ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
            error: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
            walletRequired: '💳 จำเป็นต้องเชื่อม Wallet ก่อนใช้คำสั่งนี้',
            membershipRequired: '🎯 จำเป็นต้องมีสมาชิกภาพก่อนใช้คำสั่งนี้'
        };
    }

    // Development mode settings
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    getTestUser() {
        if (this.isDevelopment()) {
            return {
                id: 12345678,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                language_code: 'en'
            };
        }
        return null;
    }
}

module.exports = new TelegramConfig();