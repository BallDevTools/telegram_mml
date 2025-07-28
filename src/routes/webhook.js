// src/routes/webhook.js - Bot notification triggers
const express = require('express');
const router = express.Router();
const telegramBotService = require('../services/telegramBotService');
const User = require('../models/User');
const Membership = require('../models/Membership');

// Middleware for webhook authentication
const authenticateWebhook = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.WEBHOOK_SECRET || 'your-secret-token';
    
    if (authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Webhook for new member registration
router.post('/member-registered', authenticateWebhook, async (req, res) => {
    try {
        const { memberAddress, uplineAddress, planId, transactionHash } = req.body;
        
        // Find users
        const member = await User.findOne({ walletAddress: memberAddress.toLowerCase() });
        const upline = await User.findOne({ walletAddress: uplineAddress.toLowerCase() });
        
        if (member && upline) {
            // Get plan info
            const web3Service = require('../services/web3Service');
            const planInfo = await web3Service.getPlanInfo(planId);
            
            // Send notification to upline
            await telegramBotService.notifyNewReferral(
                upline.telegramId,
                member.firstName,
                planInfo.name
            );
            
            console.log(`✅ Referral notification sent: ${member.firstName} -> ${upline.firstName}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Member registration webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook for commission payment
router.post('/commission-paid', authenticateWebhook, async (req, res) => {
    try {
        const { recipientAddress, amount, fromAddress, planId } = req.body;
        
        // Find users
        const recipient = await User.findOne({ walletAddress: recipientAddress.toLowerCase() });
        const fromUser = await User.findOne({ walletAddress: fromAddress.toLowerCase() });
        
        if (recipient && fromUser) {
            // Get plan info
            const web3Service = require('../services/web3Service');
            const planInfo = await web3Service.getPlanInfo(planId);
            
            // Format amount (from wei to USDT)
            const formattedAmount = (parseInt(amount) / 1000000).toFixed(2);
            
            // Send notification
            await telegramBotService.notifyCommissionReceived(
                recipient.telegramId,
                formattedAmount,
                fromUser.firstName,
                planInfo.name
            );
            
            console.log(`✅ Commission notification sent: ${formattedAmount} USDT to ${recipient.firstName}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Commission webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook for plan upgrade
router.post('/plan-upgraded', authenticateWebhook, async (req, res) => {
    try {
        const { memberAddress, oldPlanId, newPlanId, transactionHash } = req.body;
        
        // Find user
        const user = await User.findOne({ walletAddress: memberAddress.toLowerCase() });
        
        if (user) {
            // Get plan info
            const web3Service = require('../services/web3Service');
            const oldPlan = await web3Service.getPlanInfo(oldPlanId);
            const newPlan = await web3Service.getPlanInfo(newPlanId);
            
            // Send notification
            await telegramBotService.notifyUpgradeSuccess(
                user.telegramId,
                oldPlan.name,
                newPlan.name
            );
            
            console.log(`✅ Upgrade notification sent: ${user.firstName} upgraded to ${newPlan.name}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Upgrade webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook for system alerts
router.post('/system-alert', authenticateWebhook, async (req, res) => {
    try {
        const { type, message, severity } = req.body;
        
        // Send to admin/owner
        const adminUserId = process.env.ADMIN_TELEGRAM_ID;
        
        if (adminUserId) {
            const alertMessage = `🚨 <b>System Alert</b>\n\n` +
                               `Type: <code>${type}</code>\n` +
                               `Severity: <b>${severity}</b>\n` +
                               `Message: ${message}\n\n` +
                               `Time: ${new Date().toLocaleString()}`;
            
            await telegramBotService.bot.sendMessage(adminUserId, alertMessage, {
                parse_mode: 'HTML'
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('System alert webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual trigger for testing (remove in production)
router.post('/test-notification', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    
    try {
        const { userId, type } = req.body;
        
        switch (type) {
            case 'referral':
                await telegramBotService.notifyNewReferral(userId, 'Test User', 'Starter Plan');
                break;
            case 'commission':
                await telegramBotService.notifyCommissionReceived(userId, '5.00', 'Test User', 'Gold Plan');
                break;
            case 'upgrade':
                await telegramBotService.notifyUpgradeSuccess(userId, 'Starter', 'Premium');
                break;
        }
        
        res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;