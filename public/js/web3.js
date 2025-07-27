// public/js/web3.js
class Web3Manager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.isConnected = false;
        
        this.contractAddress = window.APP_DATA.contractAddress;
        this.chainId = parseInt(window.APP_DATA.chainId);
        this.rpcUrl = window.APP_DATA.rpcUrl;
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize ethers provider
            if (window.ethereum) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                await this.checkConnection();
            } else {
                // Fallback to RPC provider
                this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
            }
            
            // Initialize contract
            await this.initContract();
            
        } catch (error) {
            console.error('Web3 initialization error:', error);
        }
    }
    
    async checkConnection() {
        try {
            const accounts = await this.provider.listAccounts();
            if (accounts.length > 0) {
                this.isConnected = true;
                this.signer = this.provider.getSigner();
                this.updateUI(accounts[0]);
            }
        } catch (error) {
            console.error('Connection check error:', error);
        }
    }
    
    async initContract() {
        try {
            const response = await fetch('/api/contract/abi');
            const abi = await response.json();
            
            if (this.signer) {
                this.contract = new ethers.Contract(this.contractAddress, abi, this.signer);
            } else {
                this.contract = new ethers.Contract(this.contractAddress, abi, this.provider);
            }
        } catch (error) {
            console.error('Contract initialization error:', error);
        }
    }
    
    async connectWallet() {
        try {
            if (!window.ethereum) {
                this.showMobileWalletOptions();
                return false;
            }
            
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length > 0) {
                // Check if on correct network
                await this.switchToCorrectNetwork();
                
                this.isConnected = true;
                this.signer = this.provider.getSigner();
                await this.initContract();
                this.updateUI(accounts[0]);
                
                return accounts[0];
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            window.Telegram.WebApp.showAlert('Failed to connect wallet');
            return false;
        }
    }
    
    async switchToCorrectNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${this.chainId.toString(16)}` }]
            });
        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902) {
                await this.addBSCNetwork();
            } else {
                throw switchError;
            }
        }
    }
    
    async addBSCNetwork() {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x38',
                chainName: 'Binance Smart Chain',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/']
            }]
        });
    }
    
    showMobileWalletOptions() {
        const options = `
            <div class="mobile-wallet-options">
                <button onclick="window.web3Manager.connectWalletConnect()">WalletConnect</button>
                <button onclick="window.web3Manager.openMetaMaskMobile()">MetaMask Mobile</button>
                <button onclick="window.web3Manager.openTrustWallet()">Trust Wallet</button>
            </div>
        `;
        
        // Show in modal or update UI
        document.getElementById('walletOptions').innerHTML = options;
    }
    
    async connectWalletConnect() {
        // Implement WalletConnect integration
        const wcLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
        window.open(wcLink, '_blank');
    }
    
    openMetaMaskMobile() {
        const deepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
        window.location.href = deepLink;
    }
    
    openTrustWallet() {
        const deepLink = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(window.location.href)}`;
        window.location.href = deepLink;
    }
    
    updateUI(address) {
        // Update wallet UI elements
        const elements = document.querySelectorAll('.wallet-address');
        elements.forEach(el => {
            el.textContent = `${address.substring(0, 6)}...${address.substring(38)}`;
        });
        
        const connectBtns = document.querySelectorAll('.connect-wallet-btn');
        connectBtns.forEach(btn => {
            btn.style.display = 'none';
        });
        
        const connectedElements = document.querySelectorAll('.wallet-connected');
        connectedElements.forEach(el => {
            el.style.display = 'block';
        });
    }
    
    async registerMember(planId, uplineAddress) {
        if (!this.contract || !this.signer) {
            throw new Error('Contract not initialized or wallet not connected');
        }
        
        try {
            // Get plan info
            const planInfo = await this.contract.getPlanInfo(planId);
            const planPrice = planInfo.price;
            
            // Check USDT approval
            const usdtContract = new ethers.Contract(
                window.APP_DATA.usdtAddress,
                ['function approve(address spender, uint256 amount) external returns (bool)',
                 'function allowance(address owner, address spender) external view returns (uint256)',
                 'function balanceOf(address account) external view returns (uint256)'],
                this.signer
            );
            
            const currentAllowance = await usdtContract.allowance(
                await this.signer.getAddress(),
                this.contractAddress
            );
            
            // Approve USDT if needed
            if (currentAllowance.lt(planPrice)) {
                window.Telegram.WebApp.showAlert('Approving USDT...');
                const approveTx = await usdtContract.approve(this.contractAddress, planPrice);
                await approveTx.wait();
            }
            
            // Register member
            window.Telegram.WebApp.showAlert('Registering membership...');
            const tx = await this.contract.registerMember(planId, uplineAddress);
            const receipt = await tx.wait();
            
            // Update backend
            await this.updateBackend(tx.hash, planId);
            
            return receipt;
            
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    
    async upgradePlan(newPlanId) {
        if (!this.contract || !this.signer) {
            throw new Error('Contract not initialized or wallet not connected');
        }
        
        try {
            // Get current and new plan info
            const newPlanInfo = await this.contract.getPlanInfo(newPlanId);
            const memberInfo = await this.contract.members(await this.signer.getAddress());
            const currentPlanInfo = await this.contract.getPlanInfo(memberInfo.planId);
            
            const priceDifference = newPlanInfo.price.sub(currentPlanInfo.price);
            
            // Check USDT approval for upgrade
            const usdtContract = new ethers.Contract(
                window.APP_DATA.usdtAddress,
                ['function approve(address spender, uint256 amount) external returns (bool)',
                 'function allowance(address owner, address spender) external view returns (uint256)'],
                this.signer
            );
            
            const currentAllowance = await usdtContract.allowance(
                await this.signer.getAddress(),
                this.contractAddress
            );
            
            if (currentAllowance.lt(priceDifference)) {
                window.Telegram.WebApp.showAlert('Approving USDT for upgrade...');
                const approveTx = await usdtContract.approve(this.contractAddress, priceDifference);
                await approveTx.wait();
            }
            
            // Upgrade plan
            window.Telegram.WebApp.showAlert('Upgrading plan...');
            const tx = await this.contract.upgradePlan(newPlanId);
            const receipt = await tx.wait();
            
            // Update backend
            await this.updateBackend(tx.hash, newPlanId);
            
            return receipt;
            
        } catch (error) {
            console.error('Upgrade error:', error);
            throw error;
        }
    }
    
    async updateBackend(txHash, planId) {
        try {
            const response = await fetch('/api/membership/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transactionHash: txHash,
                    planId: planId,
                    walletAddress: await this.signer.getAddress()
                })
            });
            
            if (!response.ok) {
                console.error('Backend update failed');
            }
        } catch (error) {
            console.error('Backend update error:', error);
        }
    }
}

// Initialize Web3Manager
window.web3Manager = new Web3Manager();

// Global functions for UI
async function connectWallet() {
    return await window.web3Manager.connectWallet();
}

async function registerOrUpgradeMembership(planId) {
    try {
        const address = await window.web3Manager.signer?.getAddress();
        if (!address) {
            await connectWallet();
            return;
        }
        
        // Check if user is already a member
        const memberInfo = await window.web3Manager.contract.members(address);
        const isExistingMember = memberInfo.planId.gt(0);
        
        if (isExistingMember) {
            // Upgrade
            await window.web3Manager.upgradePlan(planId);
            window.Telegram.WebApp.showAlert('Plan upgraded successfully!');
        } else {
            // New registration
            const uplineAddress = getUplineFromReferral() || window.APP_DATA.ownerAddress;
            await window.web3Manager.registerMember(planId, uplineAddress);
            window.Telegram.WebApp.showAlert('Membership registered successfully!');
        }
        
        // Refresh page after successful transaction
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Transaction error:', error);
        window.Telegram.WebApp.showAlert(`Transaction failed: ${error.message}`);
    }
}

function getUplineFromReferral() {
    const referralData = JSON.parse(localStorage.getItem('referralData') || '{}');
    return referralData.address || null;
}