// scripts/testBot.js - Test bot functionality
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function testBot() {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    console.log('🧪 Testing bot functionality...\n');
    
    try {
        // 1. Test bot info
        const botInfo = await bot.getMe();
        console.log('✅ Bot Info:', botInfo.username);
        
        // 2. Test commands
        const commands = await bot.getMyCommands();
        console.log('✅ Commands loaded:', commands.length);
        commands.forEach(cmd => {
            console.log(`  /${cmd.command} - ${cmd.description}`);
        });
        
        // 3. Test webhook info (if set)
        try {
            const webhookInfo = await bot.getWebHookInfo();
            console.log('\n📡 Webhook Info:', {
                url: webhookInfo.url || 'Not set',
                pending_update_count: webhookInfo.pending_update_count,
                last_error_date: webhookInfo.last_error_date || 'None'
            });
        } catch (error) {
            console.log('📡 Webhook: Not configured');
        }
        
        // 4. Test sending message (if test user ID provided)
        const testUserId = process.env.TEST_TELEGRAM_USER_ID;
        if (testUserId) {
            console.log('\n📤 Sending test message...');
            
            const testMessage = `🧪 <b>Bot Test Message</b>\n\n` +
                              `✅ Bot is working correctly!\n` +
                              `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                              `🤖 Commands available:\n` +
                              `• /start - เริ่มใช้งาน\n` +
                              `• /plans - ดูแผน\n` +
                              `• /help - ความช่วยเหลือ`;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🚀 เปิดแอพ', web_app: { url: process.env.APP_URL || 'https://example.com' } }],
                    [{ text: '📋 ดูแผน', callback_data: 'view_plans' }]
                ]
            };
            
            await bot.sendMessage(testUserId, testMessage, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
            
            console.log('✅ Test message sent successfully');
        } else {
            console.log('⚠️  TEST_TELEGRAM_USER_ID not set, skipping message test');
        }
        
        // 5. Test webhook endpoints (if server is running)
        if (process.env.WEBHOOK_URL) {
            console.log('\n🎣 Testing webhook endpoints...');
            
            const fetch = (await import('node-fetch')).default;
            const testEndpoints = [
                '/webhook/member-registered',
                '/webhook/commission-paid',
                '/webhook/plan-upgraded'
            ];
            
            for (const endpoint of testEndpoints) {
                try {
                    const response = await fetch(`${process.env.WEBHOOK_URL}${endpoint}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`
                        },
                        body: JSON.stringify({
                            test: true,
                            timestamp: new Date().toISOString()
                        })
                    });
                    
                    console.log(`  ${endpoint}: ${response.ok ? '✅' : '❌'} ${response.status}`);
                } catch (error) {
                    console.log(`  ${endpoint}: ❌ ${error.message}`);
                }
            }
        }
        
        console.log('\n🎉 Bot test completed!');
        
        // Generate test commands for user
        console.log('\n📝 Test these commands in Telegram:');
        console.log(`   https://t.me/${botInfo.username}`);
        console.log('   /start');
        console.log('   /plans');
        console.log('   /help');
        
    } catch (error) {
        console.error('❌ Bot test failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    testBot().then(() => {
        console.log('\n👋 Test finished');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = testBot;