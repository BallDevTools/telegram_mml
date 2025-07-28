// src/services/contractService.js - Smart contract interactions
const { ethers } = require('ethers');
const contractABI = require('../../contracts/abi/CryptoMembershipNFT.json');

class ContractService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.contractAddress = process.env.CONTRACT_ADDRESS;
        this.usdtAddress = process.env.USDT_CONTRACT_ADDRESS;
        this.chainId = parseInt(process.env.CHAIN_ID) || 56;
        
        // Initialize contract instance
        this.contract = new ethers.Contract(
            this.contractAddress,
            contractABI,
            this.provider
        );
        
        // USDT contract ABI (minimal)
        this.usdtABI = [
            'function balanceOf(address account) view returns (uint256)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function transfer(address to, uint256 amount) external returns (bool)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)'
        ];
        
        this.usdtContract = new ethers.Contract(
            this.usdtAddress,
            this.usdtABI,
            this.provider
        );
        
        // Initialize admin signer if private key is available
        if (process.env.PRIVATE_KEY) {
            this.adminSigner = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
            this.adminContract = new ethers.Contract(
                this.contractAddress,
                contractABI,
                this.adminSigner
            );
        }
        
        console.log('🔗 Contract Service initialized');
    }

    // Member Information Methods
    async getMemberInfo(walletAddress) {
        try {
            const member = await this.contract.members(walletAddress);
            const tokenBalance = await this.contract.balanceOf(walletAddress);
            
            if (tokenBalance.toString() === '0') {
                return null; // Not a member
            }

            return {
                upline: member.upline,
                totalReferrals: member.totalReferrals.toString(),
                totalEarnings: member.totalEarnings.toString(),
                planId: member.planId.toString(),
                cycleNumber: member.cycleNumber.toString(),
                registeredAt: new Date(Number(member.registeredAt) * 1000),
                isActive: tokenBalance.gt(0)
            };
        } catch (error) {
            console.error('Error getting member info:', error);
            throw new Error(`Failed to get member info: ${error.message}`);
        }
    }

    async isMember(walletAddress) {
        try {
            const balance = await this.contract.balanceOf(walletAddress);
            return balance.gt(0);
        } catch (error) {
            console.error('Error checking membership:', error);
            return false;
        }
    }

    async getMembershipLevel(walletAddress) {
        try {
            const member = await this.contract.members(walletAddress);
            return parseInt(member.planId.toString());
        } catch (error) {
            console.error('Error getting membership level:', error);
            return 0;
        }
    }

    // Plan Information Methods
    async getPlanInfo(planId) {
        try {
            const plan = await this.contract.getPlanInfo(planId);
            return {
                price: plan.price.toString(),
                name: plan.name,
                membersPerCycle: plan.membersPerCycle.toString(),
                isActive: plan.isActive,
                imageURI: plan.imageURI
            };
        } catch (error) {
            console.error(`Error getting plan ${planId} info:`, error);
            throw new Error(`Failed to get plan info: ${error.message}`);
        }
    }

    async getPlanCycleInfo(planId) {
        try {
            const cycleInfo = await this.contract.getPlanCycleInfo(planId);
            return {
                currentCycle: cycleInfo.currentCycle.toString(),
                membersInCurrentCycle: cycleInfo.membersInCurrentCycle.toString(),
                membersPerCycle: cycleInfo.membersPerCycle.toString()
            };
        } catch (error) {
            console.error(`Error getting plan ${planId} cycle info:`, error);
            throw new Error(`Failed to get cycle info: ${error.message}`);
        }
    }

    async getAllPlansInfo() {
        try {
            const plans = [];
            for (let i = 1; i <= 16; i++) {
                try {
                    const planInfo = await this.getPlanInfo(i);
                    const cycleInfo = await this.getPlanCycleInfo(i);
                    
                    plans.push({
                        id: i,
                        ...planInfo,
                        ...cycleInfo,
                        priceUSDT: (parseInt(planInfo.price) / 1000000).toFixed(0)
                    });
                } catch (error) {
                    console.error(`Error fetching plan ${i}:`, error);
                    // Continue with other plans
                }
            }
            return plans;
        } catch (error) {
            console.error('Error getting all plans info:', error);
            throw new Error(`Failed to get plans info: ${error.message}`);
        }
    }

    // System Statistics
    async getSystemStats() {
        try {
            const stats = await this.contract.getSystemStats();
            return {
                totalMembers: stats.totalMembers.toString(),
                totalRevenue: stats.totalRevenue.toString(),
                totalCommission: stats.totalCommission.toString(),
                ownerFunds: stats.ownerFunds.toString(),
                feeFunds: stats.feeFunds.toString(),
                fundFunds: stats.fundFunds.toString()
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            throw new Error(`Failed to get system stats: ${error.message}`);
        }
    }

    // NFT Methods
    async getNFTImage(tokenId) {
        try {
            const nftData = await this.contract.getNFTImage(tokenId);
            return {
                imageURI: nftData.imageURI,
                name: nftData.name,
                description: nftData.description,
                planId: nftData.planId.toString(),
                createdAt: new Date(Number(nftData.createdAt) * 1000)
            };
        } catch (error) {
            console.error(`Error getting NFT ${tokenId} image:`, error);
            throw new Error(`Failed to get NFT image: ${error.message}`);
        }
    }

    async getUserNFTs(walletAddress) {
        try {
            const balance = await this.contract.balanceOf(walletAddress);
            const nfts = [];
            
            for (let i = 0; i < balance; i++) {
                try {
                    const tokenId = await this.contract.tokenOfOwnerByIndex(walletAddress, i);
                    const nftData = await this.getNFTImage(tokenId);
                    nfts.push({
                        tokenId: tokenId.toString(),
                        ...nftData
                    });
                } catch (error) {
                    console.error(`Error getting NFT at index ${i}:`, error);
                }
            }
            
            return nfts;
        } catch (error) {
            console.error('Error getting user NFTs:', error);
            throw new Error(`Failed to get user NFTs: ${error.message}`);
        }
    }

    // USDT Methods
    async getUSDTBalance(walletAddress) {
        try {
            const balance = await this.usdtContract.balanceOf(walletAddress);
            return {
                raw: balance.toString(),
                formatted: ethers.utils.formatUnits(balance, 6)
            };
        } catch (error) {
            console.error('Error getting USDT balance:', error);
            return { raw: '0', formatted: '0' };
        }
    }

    async getUSDTAllowance(owner, spender) {
        try {
            const allowance = await this.usdtContract.allowance(owner, spender);
            return {
                raw: allowance.toString(),
                formatted: ethers.utils.formatUnits(allowance, 6)
            };
        } catch (error) {
            console.error('Error getting USDT allowance:', error);
            return { raw: '0', formatted: '0' };
        }
    }

    // Transaction Methods
    async getTransaction(txHash) {
        try {
            const tx = await this.provider.getTransaction(txHash);
            const receipt = await this.provider.getTransactionReceipt(txHash);
            
            return {
                transaction: tx,
                receipt: receipt,
                status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending'
            };
        } catch (error) {
            console.error('Error getting transaction:', error);
            throw new Error(`Failed to get transaction: ${error.message}`);
        }
    }

    async waitForTransaction(txHash, confirmations = 3) {
        try {
            const receipt = await this.provider.waitForTransaction(txHash, confirmations);
            return {
                receipt: receipt,
                status: receipt.status === 1 ? 'success' : 'failed',
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('Error waiting for transaction:', error);
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }

    // Event Parsing
    parseEvents(receipt, eventName = null) {
        try {
            const events = [];
            
            for (const log of receipt.logs) {
                try {
                    if (log.address.toLowerCase() === this.contractAddress.toLowerCase()) {
                        const parsed = this.contract.interface.parseLog(log);
                        
                        if (!eventName || parsed.name === eventName) {
                            events.push({
                                name: parsed.name,
                                args: parsed.args,
                                blockNumber: log.blockNumber,
                                transactionHash: log.transactionHash,
                                logIndex: log.logIndex
                            });
                        }
                    }
                } catch (error) {
                    // Skip unparseable logs
                }
            }
            
            return events;
        } catch (error) {
            console.error('Error parsing events:', error);
            return [];
        }
    }

    // Admin Methods (require admin signer)
    async updatePlanPrice(planId, newPrice) {
        if (!this.adminContract) {
            throw new Error('Admin signer not configured');
        }
        
        try {
            const priceInWei = ethers.utils.parseUnits(newPrice.toString(), 6);
            const tx = await this.adminContract.updatePlanPrice(planId, priceInWei);
            return await tx.wait();
        } catch (error) {
            console.error('Error updating plan price:', error);
            throw new Error(`Failed to update plan price: ${error.message}`);
        }
    }

    async setPlanStatus(planId, isActive) {
        if (!this.adminContract) {
            throw new Error('Admin signer not configured');
        }
        
        try {
            const tx = await this.adminContract.setPlanStatus(planId, isActive);
            return await tx.wait();
        } catch (error) {
            console.error('Error setting plan status:', error);
            throw new Error(`Failed to set plan status: ${error.message}`);
        }
    }

    async pauseContract() {
        if (!this.adminContract) {
            throw new Error('Admin signer not configured');
        }
        
        try {
            const tx = await this.adminContract.setPaused(true);
            return await tx.wait();
        } catch (error) {
            console.error('Error pausing contract:', error);
            throw new Error(`Failed to pause contract: ${error.message}`);
        }
    }

    async unpauseContract() {
        if (!this.adminContract) {
            throw new Error('Admin signer not configured');
        }
        
        try {
            const tx = await this.adminContract.setPaused(false);
            return await tx.wait();
        } catch (error) {
            console.error('Error unpausing contract:', error);
            throw new Error(`Failed to unpause contract: ${error.message}`);
        }
    }

    async withdrawOwnerBalance(amount) {
        if (!this.adminContract) {
            throw new Error('Admin signer not configured');
        }
        
        try {
            const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);
            const tx = await this.adminContract.withdrawOwnerBalance(amountInWei);
            return await tx.wait();
        } catch (error) {
            console.error('Error withdrawing owner balance:', error);
            throw new Error(`Failed to withdraw owner balance: ${error.message}`);
        }
    }

    // Utility Methods
    formatUSDT(amount, decimals = 2) {
        try {
            const formatted = ethers.utils.formatUnits(amount, 6);
            return parseFloat(formatted).toFixed(decimals);
        } catch (error) {
            return '0.00';
        }
    }

    parseUSDT(amount) {
        try {
            return ethers.utils.parseUnits(amount.toString(), 6);
        } catch (error) {
            throw new Error('Invalid USDT amount');
        }
    }

    isValidAddress(address) {
        return ethers.utils.isAddress(address);
    }

    isValidTransactionHash(hash) {
        return /^0x[a-fA-F0-9]{64}$/.test(hash);
    }

    // Network Information
    async getNetworkInfo() {
        try {
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            const gasPrice = await this.provider.getGasPrice();
            
            return {
                chainId: network.chainId,
                name: network.name,
                blockNumber: blockNumber,
                gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei'
            };
        } catch (error) {
            console.error('Error getting network info:', error);
            throw new Error(`Failed to get network info: ${error.message}`);
        }
    }

    // Health Check
    async healthCheck() {
        try {
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            
            // Test contract read
            const stats = await this.getSystemStats();
            
            return {
                status: 'healthy',
                network: network.name,
                chainId: network.chainId,
                blockNumber: blockNumber,
                contractAddress: this.contractAddress,
                totalMembers: stats.totalMembers,
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
}

module.exports = ContractService;