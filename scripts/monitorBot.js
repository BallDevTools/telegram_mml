// scripts/monitorBot.js - Monitor bot performance
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

class BotMonitor {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        this.stats = {
            messagesReceived: 0,
            commandsProcessed: 0,
            errorsOccurred: 0,
            startTime: new Date(),
            lastActivity: new Date()
        };
        
        this.setupMonitoring();
    }
    
    setupMonitoring() {
        // Monitor incoming messages
        this.bot.on('message', (msg) => {
            this.stats.messagesReceived++;
            this.stats.lastActivity = new Date();
            
            if (msg.text && msg.text.startsWith('/')) {
                this.stats.commandsProcessed++;
                console.log(`📨 Command: ${msg.text} from ${msg.from.first_name} (${msg.from.id})`);
            }
        });
        
        // Monitor errors
        this.bot.on('error', (error) => {
            this.stats.errorsOccurred++;
            console.error('❌ Bot Error:', error);
            this.sendAlertToAdmin('Bot Error', error.message);
        });
        
        this.bot.on('polling_error', (error) => {
            this.stats.errorsOccurred++;
            console.error('❌ Polling Error:', error);
            this.sendAlertToAdmin('Polling Error', error.message);
        });
        
        // Monitor callback queries
        this.bot.on('callback_query', (query) => {
            console.log(`🔘 Callback: ${query.data} from ${query.from.first_name} (${query.from.id})`);
        });
        
        // Periodic health check
        setInterval(() => {
            this.healthCheck();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        console.log('📊 Bot monitoring started');
    }
    
    async healthCheck() {
        try {
            // Test bot connectivity
            const botInfo = await this.bot.getMe();
            
            // Check if bot is responsive
            const now = new Date();
            const timeSinceActivity = now - this.stats.lastActivity;
            
            // Alert if no activity for 30 minutes
            if (timeSinceActivity > 30 * 60 * 1000) {
                await this.sendAlertToAdmin(
                    'Bot Inactive',
                    `No activity for ${Math.round(timeSinceActivity / 60000)} minutes`
                );
            }
            
            // Log stats
            console.log(`📊 Bot Health Check:`, {
                status: 'OK',
                uptime: Math.round((now - this.stats.startTime) / 1000 / 60), // minutes
                messages: this.stats.messagesReceived,
                commands: this.stats.commandsProcessed,
                errors: this.stats.errorsOccurred,
                lastActivity: this.stats.lastActivity.toLocaleTimeString()
            });
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            await this.sendAlertToAdmin('Health Check Failed', error.message);
        }
    }
    
    async sendAlertToAdmin(title, message) {
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (!adminId) return;
        
        try {
            const alertMessage = `🚨 <b>${title}</b>\n\n` +
                               `Message: ${message}\n` +
                               `Time: ${new Date().toLocaleString()}\n` +
                               `Server: ${process.env.NODE_ENV || 'unknown'}`;
            
            await this.bot.sendMessage(adminId, alertMessage, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('❌ Failed to send alert to admin:', error);
        }
    }
    
    getStats() {
        const now = new Date();
        const uptime = Math.round((now - this.stats.startTime) / 1000 / 60);
        
        return {
            ...this.stats,
            uptime: `${uptime} minutes`,
            averageCommandsPerMinute: uptime > 0 ? (this.stats.commandsProcessed / uptime).toFixed(2) : 0
        };
    }
    
    // API endpoint for stats
    setupStatsEndpoint(app) {
        app.get('/bot-stats', (req, res) => {
            res.json({
                status: 'active',
                stats: this.getStats(),
                timestamp: new Date().toISOString()
            });
        });
    }
}

module.exports = BotMonitor;