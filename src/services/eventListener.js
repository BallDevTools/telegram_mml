// src/services/eventListener.js - Listen to smart contract events
const { ethers } = require('ethers');
const contractABI = require('../../contracts/abi/CryptoMembershipNFT.json');

class ContractEventListener {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.contract = new ethers.Contract(
            process.env.CONTRACT_ADDRESS,
            contractABI,
            this.provider
        );
        
        this.webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
        this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-secret-token';
        
        this.setupEventListeners();
        console.log('🎧 Contract Event Listener initialized');
    }

    setupEventListeners() {
        // Listen for MemberRegistered events
        this.contract.on('MemberRegistered', async (member, upline, planId, cycleNumber, event) => {
            console.log('📝 MemberRegistered event:', {
                member,
                upline,
                planId: planId.toString(),
                cycleNumber: cycleNumber.toString()
            });
            
            await this.triggerWebhook('/member-registered', {
                memberAddress: member,
                uplineAddress: upline,
                planId: planId.toString(),
                cycleNumber: cycleNumber.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Listen for ReferralPaid events
        this.contract.on('ReferralPaid', async (from, to, amount, event) => {
            console.log('💰 ReferralPaid event:', {
                from,
                to,
                amount: amount.toString()
            });
            
            // Get member info to determine plan
            try {
                const memberInfo = await this.contract.members(from);
                await this.triggerWebhook('/commission-paid', {
                    recipientAddress: to,
                    fromAddress: from,
                    amount: amount.toString(),
                    planId: memberInfo.planId.toString(),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                console.error('Error processing ReferralPaid event:', error);
            }
        });

        // Listen for PlanUpgraded events
        this.contract.on('PlanUpgraded', async (member, oldPlanId, newPlanId, cycleNumber, event) => {
            console.log('⬆️ PlanUpgraded event:', {
                member,
                oldPlanId: oldPlanId.toString(),
                newPlanId: newPlanId.toString(),
                cycleNumber: cycleNumber.toString()
            });
            
            await this.triggerWebhook('/plan-upgraded', {
                memberAddress: member,
                oldPlanId: oldPlanId.toString(),
                newPlanId: newPlanId.toString(),
                cycleNumber: cycleNumber.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Listen for MemberExited events
        this.contract.on('MemberExited', async (member, refundAmount, event) => {
            console.log('👋 MemberExited event:', {
                member,
                refundAmount: refundAmount.toString()
            });
            
            await this.triggerWebhook('/member-exited', {
                memberAddress: member,
                refundAmount: refundAmount.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Listen for NewCycleStarted events
        this.contract.on('NewCycleStarted', async (planId, cycleNumber, event) => {
            console.log('🔄 NewCycleStarted event:', {
                planId: planId.toString(),
                cycleNumber: cycleNumber.toString()
            });
            
            await this.triggerWebhook('/cycle-started', {
                planId: planId.toString(),
                cycleNumber: cycleNumber.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Listen for EmergencyWithdraw events (system alerts)
        this.contract.on('EmergencyWithdraw', async (to, amount, event) => {
            console.log('🚨 EmergencyWithdraw event:', {
                to,
                amount: amount.toString()
            });
            
            await this.triggerWebhook('/system-alert', {
                type: 'emergency_withdraw',
                message: `Emergency withdrawal of ${ethers.utils.formatUnits(amount, 6)} USDT to ${to}`,
                severity: 'critical',
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Handle connection errors
        this.provider.on('error', (error) => {
            console.error('❌ Provider error:', error);
            this.handleConnectionError(error);
        });
    }

    async triggerWebhook(endpoint, data) {
        try {
            const fetch = (await import('node-fetch')).default;
            
            const response = await fetch(`${this.webhookUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.webhookSecret}`
                },
                body: JSON.stringify({
                    ...data,
                    timestamp: new Date().toISOString(),
                    network: 'bsc-testnet'
                })
            });

            if (!response.ok) {
                throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
            }

            console.log(`✅ Webhook triggered: ${endpoint}`);
        } catch (error) {
            console.error(`❌ Webhook error for ${endpoint}:`, error);
            
            // Store failed webhook for retry
            await this.storeFailedWebhook(endpoint, data, error.message);
        }
    }

    async storeFailedWebhook(endpoint, data, error) {
        // Store in database or file for retry mechanism
        const failedWebhook = {
            endpoint,
            data,
            error,
            timestamp: new Date().toISOString(),
            retryCount: 0
        };
        
        // Could implement MongoDB storage here
        console.log('📝 Storing failed webhook for retry:', failedWebhook);
    }

    handleConnectionError(error) {
        console.error('🔌 Connection error, attempting to reconnect...', error);
        
        // Implement reconnection logic
        setTimeout(() => {
            this.reconnect();
        }, 5000);
    }

    reconnect() {
        try {
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            this.contract = new ethers.Contract(
                process.env.CONTRACT_ADDRESS,
                contractABI,
                this.provider
            );
            
            this.setupEventListeners();
            console.log('🔌 Reconnected to contract events');
        } catch (error) {
            console.error('❌ Reconnection failed:', error);
            setTimeout(() => this.reconnect(), 10000);
        }
    }

    // Manual event fetching for missed events
    async fetchMissedEvents(fromBlock = 'latest', toBlock = 'latest') {
        try {
            console.log(`🔍 Fetching missed events from block ${fromBlock} to ${toBlock}`);
            
            const events = await this.contract.queryFilter('*', fromBlock, toBlock);
            
            for (const event of events) {
                await this.processEvent(event);
            }
            
            console.log(`✅ Processed ${events.length} missed events`);
        } catch (error) {
            console.error('❌ Error fetching missed events:', error);
        }
    }

    async processEvent(event) {
        // Process individual events manually
        switch (event.event) {
            case 'MemberRegistered':
                await this.triggerWebhook('/member-registered', {
                    memberAddress: event.args[0],
                    uplineAddress: event.args[1],
                    planId: event.args[2].toString(),
                    cycleNumber: event.args[3].toString(),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
                break;
            
            case 'ReferralPaid':
                try {
                    const memberInfo = await this.contract.members(event.args[0]);
                    await this.triggerWebhook('/commission-paid', {
                        recipientAddress: event.args[1],
                        fromAddress: event.args[0],
                        amount: event.args[2].toString(),
                        planId: memberInfo.planId.toString(),
                        transactionHash: event.transactionHash,
                        blockNumber: event.blockNumber
                    });
                } catch (error) {
                    console.error('Error processing ReferralPaid event:', error);
                }
                break;
            
            // Add other event types as needed
        }
    }

    // Graceful shutdown
    stop() {
        try {
            this.contract.removeAllListeners();
            console.log('🛑 Event listener stopped');
        } catch (error) {
            console.error('❌ Error stopping event listener:', error);
        }
    }
}

module.exports = ContractEventListener;