// src/utils/analytics.js
const mixpanel = require('mixpanel');

class Analytics {
    constructor() {
        this.mixpanel = mixpanel.init(process.env.MIXPANEL_TOKEN);
    }
    
    track(event, userId, properties = {}) {
        this.mixpanel.track(event, {
            distinct_id: userId,
            ...properties,
            timestamp: new Date().toISOString()
        });
    }
    
    trackMembershipRegistration(user, planId, transactionHash) {
        this.track('Membership Registered', user.telegramId, {
            plan_id: planId,
            transaction_hash: transactionHash,
            wallet_address: user.walletAddress,
            referral_code: user.referralCode
        });
    }
    
    trackPlanUpgrade(user, oldPlanId, newPlanId, transactionHash) {
        this.track('Plan Upgraded', user.telegramId, {
            old_plan_id: oldPlanId,
            new_plan_id: newPlanId,
            transaction_hash: transactionHash
        });
    }
    
    trackReferral(referrer, referee) {
        this.track('Referral Successful', referrer.telegramId, {
            referee_id: referee.telegramId,
            referee_name: referee.firstName
        });
    }
}

module.exports = new Analytics();