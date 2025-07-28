// src/config/web3.js
const { ethers } = require('ethers');

class Web3Config {
    constructor() {
        this.rpcUrl = process.env.RPC_URL;
        this.chainId = parseInt(process.env.CHAIN_ID) || 56;
        this.contractAddress = process.env.CONTRACT_ADDRESS;
        this.usdtAddress = process.env.USDT_CONTRACT_ADDRESS;
        this.ownerAddress = process.env.CONTRACT_OWNER_ADDRESS;
        this.privateKey = process.env.PRIVATE_KEY; // For admin operations only
        
        this.validateConfig();
        this.initializeProvider();
    }

    validateConfig() {
        if (!this.rpcUrl) {
            throw new Error('RPC_URL is required');
        }
        
        if (!this.contractAddress) {
            throw new Error('CONTRACT_ADDRESS is required');
        }
        
        if (!this.usdtAddress) {
            throw new Error('USDT_CONTRACT_ADDRESS is required');
        }

        if (!ethers.utils.isAddress(this.contractAddress)) {
            throw new Error('Invalid CONTRACT_ADDRESS format');
        }

        if (!ethers.utils.isAddress(this.usdtAddress)) {
            throw new Error('Invalid USDT_CONTRACT_ADDRESS format');
        }
    }

    initializeProvider() {
        try {
            this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
            
            // Test connection
            this.provider.getNetwork().catch(error => {
                console.error('❌ Web3 provider connection failed:', error.message);
            });
            
            // Initialize signer if private key exists (for admin operations)
            if (this.privateKey) {
                this.signer = new ethers.Wallet(this.privateKey, this.provider);
                console.log('🔑 Admin signer initialized');
            }
            
            console.log('🌐 Web3 provider initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Web3 provider:', error);
            throw error;
        }
    }

    // Network configurations
    getNetworkConfig() {
        const networks = {
            // BSC Mainnet
            56: {
                name: 'Binance Smart Chain',
                chainId: 56,
                rpcUrl: 'https://bsc-dataseed.binance.org/',
                blockExplorer: 'https://bscscan.com',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                usdtAddress: '0x55d398326f99059fF775485246999027B3197955'
            },
            
            // BSC Testnet
            97: {
                name: 'BSC Testnet',
                chainId: 97,
                rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
                blockExplorer: 'https://testnet.bscscan.com',
                nativeCurrency: {
                    name: 'tBNB',
                    symbol: 'tBNB',
                    decimals: 18
                },
                usdtAddress: '0x7ef95a0FEE0Dd31b22626fF2E1d2290e5e5a2Da0'
            }
        };
        
        return networks[this.chainId] || networks[56];
    }

    // Contract ABI configurations
    getContractABIs() {
        return {
            // Simplified ABI for common operations
            membership: [
                // Read functions
                'function members(address) view returns (address upline, uint256 totalReferrals, uint256 totalEarnings, uint256 planId, uint256 cycleNumber, uint256 registeredAt)',
                'function plans(uint256) view returns (uint256 price, string name, uint256 membersPerCycle, bool isActive)',
                'function getPlanInfo(uint256 planId) view returns (uint256 price, string name, uint256 membersPerCycle, bool isActive, string imageURI)',
                'function getPlanCycleInfo(uint256 planId) view returns (uint256 currentCycle, uint256 membersInCurrentCycle, uint256 membersPerCycle)',
                'function getSystemStats() view returns (uint256 totalMembers, uint256 totalRevenue, uint256 totalCommission, uint256 ownerFunds, uint256 feeFunds, uint256 fundFunds)',
                'function balanceOf(address owner) view returns (uint256)',
                'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
                'function tokenURI(uint256 tokenId) view returns (string)',
                'function getNFTImage(uint256 tokenId) view returns (string imageURI, string name, string description, uint256 planId, uint256 createdAt)',
                
                // Write functions
                'function registerMember(uint256 planId, address upline) external',
                'function upgradePlan(uint256 newPlanId) external',
                'function exitMembership() external',
                
                // Admin functions
                'function updatePlanPrice(uint256 planId, uint256 newPrice) external',
                'function setPlanStatus(uint256 planId, bool isActive) external',
                'function setPaused(bool paused) external',
                'function withdrawOwnerBalance(uint256 amount) external',
                'function withdrawFeeSystemBalance(uint256 amount) external',
                'function withdrawFundBalance(uint256 amount) external',
                
                // Events
                'event MemberRegistered(address indexed member, address indexed upline, uint256 planId, uint256 cycleNumber)',
                'event PlanUpgraded(address indexed member, uint256 oldPlanId, uint256 newPlanId, uint256 cycleNumber)',
                'event ReferralPaid(address indexed from, address indexed to, uint256 amount)',
                'event MemberExited(address indexed member, uint256 refundAmount)',
                'event NewCycleStarted(uint256 planId, uint256 cycleNumber)'
            ],
            
            // USDT contract ABI
            usdt: [
                'function balanceOf(address account) view returns (uint256)',
                'function allowance(address owner, address spender) view returns (uint256)',
                'function approve(address spender, uint256 amount) external returns (bool)',
                'function transfer(address to, uint256 amount) external returns (bool)',
                'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'function name() view returns (string)'
            ]
        };
    }

    // Gas configuration
    getGasConfig() {
        return {
            // Gas limits for different operations
            limits: {
                registerMember: 300000,
                upgradePlan: 250000,
                exitMembership: 200000,
                approve: 60000,
                transfer: 60000
            },
            
            // Gas price settings
            prices: {
                slow: ethers.utils.parseUnits('5', 'gwei'),
                standard: ethers.utils.parseUnits('10', 'gwei'),
                fast: ethers.utils.parseUnits('20', 'gwei')
            },
            
            // Gas price multiplier for different networks
            multipliers: {
                56: 1.1,  // BSC Mainnet
                97: 1.2   // BSC Testnet
            }
        };
    }

    // Transaction configuration
    getTransactionConfig() {
        return {
            // Confirmation requirements
            confirmations: {
                56: 3,  // BSC Mainnet
                97: 1   // BSC Testnet
            },
            
            // Timeout settings
            timeout: 120000, // 2 minutes
            
            // Retry configuration
            retry: {
                attempts: 3,
                delay: 5000 // 5 seconds
            }
        };
    }

    // Provider health check
    async healthCheck() {
        try {
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            
            return {
                status: 'healthy',
                network: network.name,
                chainId: network.chainId,
                blockNumber: blockNumber,
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

    // Contract instance creators
    getMembershipContract(signerOrProvider = null) {
        const contractABI = this.getContractABIs().membership;
        const providerOrSigner = signerOrProvider || this.provider;
        
        return new ethers.Contract(
            this.contractAddress,
            contractABI,
            providerOrSigner
        );
    }

    getUSDTContract(signerOrProvider = null) {
        const contractABI = this.getContractABIs().usdt;
        const providerOrSigner = signerOrProvider || this.provider;
        
        return new ethers.Contract(
            this.usdtAddress,
            contractABI,
            providerOrSigner
        );
    }

    // Format utilities
    formatAddress(address, chars = 4) {
        if (!address) return '';
        return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
    }

    formatUSDT(amount, decimals = 2) {
        try {
            const formatted = ethers.utils.formatUnits(amount, 6);
            return parseFloat(formatted).toFixed(decimals);
        } catch (error) {
            return '0.00';
        }
    }

    formatBNB(amount, decimals = 4) {
        try {
            const formatted = ethers.utils.formatEther(amount);
            return parseFloat(formatted).toFixed(decimals);
        } catch (error) {
            return '0.0000';
        }
    }

    parseUSDT(amount) {
        try {
            return ethers.utils.parseUnits(amount.toString(), 6);
        } catch (error) {
            throw new Error('Invalid USDT amount');
        }
    }

    // Validation utilities
    isValidAddress(address) {
        return ethers.utils.isAddress(address);
    }

    isValidTransactionHash(hash) {
        return /^0x[a-fA-F0-9]{64}$/.test(hash);
    }

    // Network switching for client-side
    getNetworkSwitchParams() {
        const config = this.getNetworkConfig();
        
        return {
            chainId: `0x${config.chainId.toString(16)}`,
            chainName: config.name,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.blockExplorer]
        };
    }

    // Event filter configurations
    getEventFilters() {
        const contract = this.getMembershipContract();
        
        return {
            memberRegistered: contract.filters.MemberRegistered(),
            planUpgraded: contract.filters.PlanUpgraded(),
            referralPaid: contract.filters.ReferralPaid(),
            memberExited: contract.filters.MemberExited(),
            newCycleStarted: contract.filters.NewCycleStarted()
        };
    }

    // Error handling
    parseContractError(error) {
        const errorMessages = {
            'Paused': 'Contract is currently paused',
            'NotMember': 'User is not a member',
            'AlreadyMember': 'User is already a member', 
            'InvalidPlanID': 'Invalid plan ID',
            'NextPlanOnly': 'Can only upgrade to next level',
            'InactivePlan': 'Plan is not active',
            'InvalidAmount': 'Invalid amount',
            'LowFundBalance': 'Insufficient fund balance',
            'ThirtyDayLock': 'Must wait 30 days before exit',
            'UplineNotMember': 'Upline is not a member',
            'UplinePlanLow': 'Upline plan level too low',
            'ZeroAddress': 'Invalid zero address',
            'NonTransferable': 'NFT is non-transferable'
        };

        // Extract error name from the error message
        let errorName = 'Unknown error';
        if (error.reason) {
            errorName = error.reason;
        } else if (error.message) {
            const match = error.message.match(/reverted with reason string '(.+)'/);
            if (match) {
                errorName = match[1];
            }
        }

        return errorMessages[errorName] || `Contract error: ${errorName}`;
    }

    // Transaction receipt parser
    parseTransactionReceipt(receipt) {
        return {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status === 1 ? 'success' : 'failed',
            timestamp: Date.now()
        };
    }

    // Event log parser
    parseEventLogs(logs, eventName) {
        const contract = this.getMembershipContract();
        const parsedLogs = [];

        for (const log of logs) {
            try {
                if (log.address.toLowerCase() === this.contractAddress.toLowerCase()) {
                    const parsed = contract.interface.parseLog(log);
                    if (!eventName || parsed.name === eventName) {
                        parsedLogs.push({
                            name: parsed.name,
                            args: parsed.args,
                            blockNumber: log.blockNumber,
                            transactionHash: log.transactionHash
                        });
                    }
                }
            } catch (error) {
                // Skip unparseable logs
            }
        }

        return parsedLogs;
    }

    // Development utilities
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    getTestConfig() {
        if (this.isDevelopment()) {
            return {
                testPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
                testAddress: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
                faucetUrl: 'https://testnet.binance.org/faucet-smart',
                testUSDTAmount: ethers.utils.parseUnits('1000', 6)
            };
        }
        return null;
    }

    // Connection status
    async getConnectionStatus() {
        try {
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            
            return {
                connected: true,
                network: network.name,
                chainId: network.chainId,
                blockNumber: blockNumber,
                rpcUrl: this.rpcUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') // Hide credentials
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                rpcUrl: this.rpcUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
            };
        }
    }

    // Price conversion utilities (for display purposes)
    async getBNBPrice() {
        try {
            // This would typically fetch from a price API
            // For now, return a placeholder
            return 300; // USD
        } catch (error) {
            return 0;
        }
    }

    convertUSDTToBNB(usdtAmount, bnbPrice = 300) {
        return parseFloat(usdtAmount) / bnbPrice;
    }

    // Batch operations configuration
    getBatchConfig() {
        return {
            maxBatchSize: 50,
            batchTimeout: 30000, // 30 seconds
            concurrentRequests: 5
        };
    }

    // Monitoring and alerting thresholds
    getMonitoringConfig() {
        return {
            thresholds: {
                gasPrice: ethers.utils.parseUnits('50', 'gwei'), // Alert if gas > 50 gwei
                blockDelay: 10, // Alert if blocks are delayed > 10 blocks
                failureRate: 0.1 // Alert if failure rate > 10%
            },
            intervals: {
                healthCheck: 60000, // 1 minute
                priceCheck: 300000, // 5 minutes
                blockCheck: 30000   // 30 seconds
            }
        };
    }
}

module.exports = new Web3Config();