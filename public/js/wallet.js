// public/js/wallet.js - Wallet connection logic
class WalletManager {
    constructor() {
        this.isConnected = false;
        this.currentWallet = null;
        this.walletAddress = null;
        this.chainId = null;
        this.supportedWallets = [
            'metamask',
            'trustwallet',
            'walletconnect',
            'binancewallet'
        ];
        
        this.init();
    }

    async init() {
        // Check if wallet is already connected
        await this.checkExistingConnection();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('💳 Wallet Manager initialized');
    }

    // Check for existing wallet connections
    async checkExistingConnection() {
        try {
            // Check MetaMask
            if (window.ethereum && window.ethereum.selectedAddress) {
                this.walletAddress = window.ethereum.selectedAddress;
                this.currentWallet = 'metamask';
                this.isConnected = true;
                
                // Verify network
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                this.chainId = parseInt(chainId, 16);
                
                this.updateUI();
                console.log('✅ Existing MetaMask connection found');
                return true;
            }

            // Check other wallets
            if (window.trustWallet && window.trustWallet.selectedAddress) {
                this.walletAddress = window.trustWallet.selectedAddress;
                this.currentWallet = 'trustwallet';
                this.isConnected = true;
                this.updateUI();
                console.log('✅ Existing Trust Wallet connection found');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking existing connection:', error);
            return false;
        }
    }

    // Setup wallet event listeners
    setupEventListeners() {
        // MetaMask events
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
            window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
            window.ethereum.on('connect', this.handleConnect.bind(this));
            window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
        }

        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isConnected) {
                this.verifyConnection();
            }
        });
    }

    // Connect to specific wallet
    async connectWallet(walletType) {
        try {
            console.log(`🔗 Connecting to ${walletType}...`);
            
            switch (walletType) {
                case 'metamask':
                    return await this.connectMetaMask();
                case 'trustwallet':
                    return await this.connectTrustWallet();
                case 'walletconnect':
                    return await this.connectWalletConnect();
                case 'binancewallet':
                    return await this.connectBinanceWallet();
                default:
                    throw new Error('Unsupported wallet type');
            }
        } catch (error) {
            console.error(`❌ ${walletType} connection failed:`, error);
            this.showError(`Failed to connect ${walletType}: ${error.message}`);
            return false;
        }
    }

    // MetaMask connection
    async connectMetaMask() {
        if (typeof window.ethereum === 'undefined') {
            // Mobile detection
            if (this.isMobile()) {
                const deepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                window.open(deepLink, '_blank');
                throw new Error('Please open this app in MetaMask mobile browser');
            } else {
                window.open('https://metamask.io/download/', '_blank');
                throw new Error('MetaMask not installed. Please install MetaMask extension.');
            }
        }

        try {
            // Request accounts
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Check/switch network
            await this.ensureCorrectNetwork();

            // Set connection details
            this.walletAddress = accounts[0];
            this.currentWallet = 'metamask';
            this.isConnected = true;

            // Save connection to backend
            await this.saveConnection();

            this.updateUI();
            this.showSuccess('MetaMask connected successfully!');
            
            return true;
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('Connection rejected by user');
            }
            throw error;
        }
    }

    // Trust Wallet connection
    async connectTrustWallet() {
        // Trust Wallet detection
        if (typeof window.trustWallet !== 'undefined') {
            try {
                const accounts = await window.trustWallet.request({
                    method: 'eth_requestAccounts'
                });

                this.walletAddress = accounts[0];
                this.currentWallet = 'trustwallet';
                this.isConnected = true;

                await this.saveConnection();
                this.updateUI();
                this.showSuccess('Trust Wallet connected successfully!');
                
                return true;
            } catch (error) {
                throw error;
            }
        } else {
            // Mobile deep link
            const deepLink = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(window.location.href)}`;
            window.open(deepLink, '_blank');
            throw new Error('Please open this app in Trust Wallet browser');
        }
    }

    // WalletConnect
    async connectWalletConnect() {
        // Note: This is a simplified version
        // In production, you'd want to use @walletconnect/web3-provider
        throw new Error('WalletConnect integration coming soon');
    }

    // Binance Wallet
    async connectBinanceWallet() {
        if (typeof window.BinanceChain === 'undefined') {
            window.open('https://www.binance.org/en/smartChain', '_blank');
            throw new Error('Binance Chain Wallet not installed');
        }

        try {
            const accounts = await window.BinanceChain.request({
                method: 'eth_requestAccounts'
            });

            this.walletAddress = accounts[0];
            this.currentWallet = 'binancewallet';
            this.isConnected = true;

            await this.saveConnection();
            this.updateUI();
            this.showSuccess('Binance Wallet connected successfully!');
            
            return true;
        } catch (error) {
            throw error;
        }
    }

    // Network management
    async ensureCorrectNetwork() {
        const targetChainId = window.APP_DATA?.chainId || '56';
        const targetChainIdHex = `0x${parseInt(targetChainId).toString(16)}`;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetChainIdHex }]
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
        const networkParams = {
            chainId: '0x38', // BSC Mainnet
            chainName: 'Binance Smart Chain',
            nativeCurrency: {
                name: 'BNB',
                symbol: 'BNB',
                decimals: 18
            },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com/']
        };

        // Use testnet for development
        if (window.APP_DATA?.chainId === '97') {
            networkParams.chainId = '0x61';
            networkParams.chainName = 'BSC Testnet';
            networkParams.rpcUrls = ['https://data-seed-prebsc-1-s1.binance.org:8545/'];
            networkParams.blockExplorerUrls = ['https://testnet.bscscan.com/'];
        }

        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkParams]
        });
    }

    // Save connection to backend
    async saveConnection() {
        try {
            const response = await fetch('/wallet/api/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    walletType: this.currentWallet
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save connection');
            }

            console.log('✅ Connection saved to backend');
            return result;
        } catch (error) {
            console.error('❌ Error saving connection:', error);
            throw error;
        }
    }

    // Disconnect wallet
    async disconnect() {
        try {
            // Clear frontend state
            this.isConnected = false;
            this.currentWallet = null;
            this.walletAddress = null;
            this.chainId = null;

            // Notify backend
            await fetch('/wallet/api/disconnect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            this.updateUI();
            this.showSuccess('Wallet disconnected');
            
            console.log('👋 Wallet disconnected');
        } catch (error) {
            console.error('❌ Error disconnecting:', error);
        }
    }

    // Event handlers
    handleAccountsChanged(accounts) {
        console.log('👤 Accounts changed:', accounts);
        
        if (accounts.length === 0) {
            // User disconnected
            this.disconnect();
        } else if (accounts[0] !== this.walletAddress) {
            // Account switched
            this.walletAddress = accounts[0];
            this.saveConnection();
            this.updateUI();
            this.showInfo('Account switched');
        }
    }

    handleChainChanged(chainId) {
        console.log('🔗 Chain changed:', chainId);
        this.chainId = parseInt(chainId, 16);
        
        const targetChainId = parseInt(window.APP_DATA?.chainId || '56');
        if (this.chainId !== targetChainId) {
            this.showWarning('Please switch to the correct network');
        }
    }

    handleConnect(connectInfo) {
        console.log('🔗 Wallet connected:', connectInfo);
    }

    handleDisconnect(error) {
        console.log('👋 Wallet disconnected:', error);
        this.disconnect();
    }

    // Connection verification
    async verifyConnection() {
        if (!this.isConnected) return false;

        try {
            if (this.currentWallet === 'metamask' && window.ethereum) {
                const accounts = await window.ethereum.request({
                    method: 'eth_accounts'
                });
                
                if (accounts.length === 0 || accounts[0] !== this.walletAddress) {
                    this.disconnect();
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Connection verification failed:', error);
            this.disconnect();
            return false;
        }
    }

    // UI Updates
    updateUI() {
        // Update wallet connection status
        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        const connectedElements = document.querySelectorAll('.wallet-connected');
        const disconnectedElements = document.querySelectorAll('.wallet-disconnected');
        const addressElements = document.querySelectorAll('.wallet-address');

        if (this.isConnected) {
            connectButtons.forEach(btn => btn.style.display = 'none');
            connectedElements.forEach(el => el.style.display = 'block');
            disconnectedElements.forEach(el => el.style.display = 'none');
            
            const shortAddress = this.formatAddress(this.walletAddress);
            addressElements.forEach(el => el.textContent = shortAddress);
        } else {
            connectButtons.forEach(btn => btn.style.display = 'block');
            connectedElements.forEach(el => el.style.display = 'none');
            disconnectedElements.forEach(el => el.style.display = 'block');
            addressElements.forEach(el => el.textContent = '');
        }

        // Trigger custom event
        window.dispatchEvent(new CustomEvent('walletStatusChanged', {
            detail: {
                connected: this.isConnected,
                address: this.walletAddress,
                wallet: this.currentWallet
            }
        }));
    }

    // Utility methods
    formatAddress(address, startChars = 6, endChars = 4) {
        if (!address) return '';
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // Notification methods
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Use Telegram WebApp notification if available
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
            return;
        }

        // Fallback to custom notification
        const notification = document.createElement('div');
        notification.className = `wallet-notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Public API
    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            walletAddress: this.walletAddress,
            currentWallet: this.currentWallet,
            chainId: this.chainId
        };
    }

    getSupportedWallets() {
        return this.supportedWallets.map(wallet => ({
            id: wallet,
            name: this.getWalletDisplayName(wallet),
            available: this.isWalletAvailable(wallet)
        }));
    }

    getWalletDisplayName(walletId) {
        const names = {
            metamask: 'MetaMask',
            trustwallet: 'Trust Wallet',
            walletconnect: 'WalletConnect',
            binancewallet: 'Binance Wallet'
        };
        return names[walletId] || walletId;
    }

    isWalletAvailable(walletId) {
        switch (walletId) {
            case 'metamask':
                return typeof window.ethereum !== 'undefined';
            case 'trustwallet':
                return typeof window.trustWallet !== 'undefined' || this.isMobile();
            case 'binancewallet':
                return typeof window.BinanceChain !== 'undefined';
            case 'walletconnect':
                return true; // Always available as it's a protocol
            default:
                return false;
        }
    }
}

// Global wallet manager instance
window.walletManager = new WalletManager();

// Global helper functions
window.connectWallet = async (walletType) => {
    return await window.walletManager.connectWallet(walletType);
};

window.disconnectWallet = async () => {
    return await window.walletManager.disconnect();
};

window.getWalletInfo = () => {
    return window.walletManager.getConnectionInfo();
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WalletManager;
}