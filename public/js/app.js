// public/js/app.js
class CryptoMembershipApp {
    constructor() {
        this.user = window.APP_DATA?.user || null;
        this.telegramUser = window.APP_DATA?.telegramUser || null;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.checkUserStatus();
        
        console.log('Crypto Membership App initialized');
    }

    setupEventListeners() {
        // Global click handlers
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // Form submission handlers
        document.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Navigation handlers
        this.setupNavigation();
        
        // Wallet connection handlers
        this.setupWalletHandlers();
        
        // Copy to clipboard handlers
        this.setupCopyHandlers();
        
        // Modal handlers
        this.setupModalHandlers();
    }

    initializeComponents() {
        // Initialize tooltips
        this.initTooltips();
        
        // Initialize lazy loading
        this.initLazyLoading();
        
        // Initialize animations
        this.initAnimations();
        
        // Auto-refresh data
        this.setupAutoRefresh();
    }

    checkUserStatus() {
        if (this.user && !this.user.walletAddress) {
            this.showWalletPrompt();
        }
    }

    handleGlobalClick(event) {
        const target = event.target;
        
        // Handle button clicks with haptic feedback
        if (target.matches('button, .btn, .cta-button')) {
            this.triggerHapticFeedback('light');
        }
        
        // Handle external links
        if (target.matches('a[href^="http"]')) {
            event.preventDefault();
            this.openExternalLink(target.href);
        }
        
        // Handle copy buttons
        if (target.matches('.copy-btn, [data-copy]')) {
            event.preventDefault();
            this.handleCopy(target);
        }
        
        // Handle modal triggers
        if (target.matches('[data-modal]')) {
            event.preventDefault();
            this.openModal(target.dataset.modal);
        }
        
        // Handle wallet connect buttons
        if (target.matches('.connect-wallet-btn')) {
            event.preventDefault();
            this.connectWallet();
        }
    }

    handleFormSubmit(event) {
        const form = event.target;
        
        if (form.matches('.ajax-form')) {
            event.preventDefault();
            this.submitAjaxForm(form);
        }
    }

    setupNavigation() {
        // Handle back button
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.BackButton.onClick(() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/';
                }
            });
        }
        
        // Setup navigation highlighting
        this.highlightCurrentNavItem();
    }

    setupWalletHandlers() {
        // Listen for wallet events
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
            window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
        }
    }

    setupCopyHandlers() {
        document.addEventListener('click', (event) => {
            if (event.target.matches('[data-copy]')) {
                this.copyToClipboard(event.target.dataset.copy);
            }
        });
    }

    setupModalHandlers() {
        // Close modal on overlay click
        document.addEventListener('click', (event) => {
            if (event.target.matches('.modal-overlay')) {
                this.closeAllModals();
            }
        });
        
        // Close modal on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // Utility Functions
    triggerHapticFeedback(type = 'light') {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            switch (type) {
                case 'light':
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                    break;
            }
        }
    }

    showAlert(message, type = 'info') {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            this.showCustomAlert(message, type);
        }
    }

    showCustomAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `custom-alert alert-${type}`;
        alertDiv.innerHTML = `
            <div class="alert-content">
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showAlert('Copied to clipboard!');
            this.triggerHapticFeedback('success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            this.showAlert('Copied to clipboard!');
            this.triggerHapticFeedback('success');
        }
    }

    openExternalLink(url) {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // Loading States
    showLoading(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (element) {
            element.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>${text}</span>
                </div>
            `;
        }
    }

    hideLoading(element, originalContent = '') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (element) {
            element.innerHTML = originalContent;
        }
    }

    // Modal Functions
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            this.triggerHapticFeedback('light');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    }

    // AJAX Functions
    async submitAjaxForm(form) {
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton?.textContent;
        
        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Processing...';
            }
            
            const response = await fetch(form.action, {
                method: form.method || 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showAlert('Success!', 'success');
                this.triggerHapticFeedback('success');
                
                // Handle specific success actions
                if (result.redirect) {
                    setTimeout(() => {
                        window.location.href = result.redirect;
                    }, 1000);
                }
            } else {
                this.showAlert(result.error || 'An error occurred', 'error');
                this.triggerHapticFeedback('error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showAlert('Network error. Please try again.', 'error');
            this.triggerHapticFeedback('error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        }
    }

    // Wallet Functions
    async connectWallet() {
        if (typeof window.web3Manager !== 'undefined') {
            return await window.web3Manager.connectWallet();
        } else {
            window.location.href = '/wallet/connect';
        }
    }

    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            this.showAlert('Wallet disconnected');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else if (this.user?.walletAddress && 
                  accounts[0].toLowerCase() !== this.user.walletAddress.toLowerCase()) {
            this.showAlert('Wallet address changed. Please refresh.');
        }
    }

    handleChainChanged(chainId) {
        if (chainId !== '0x38') { // BSC Chain ID
            this.showAlert('Please switch to Binance Smart Chain');
        }
    }

    // Data Refresh Functions
    async refreshData() {
        if (!this.user?.walletAddress) return;
        
        try {
            const response = await fetch('/api/membership/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.showAlert('Data refreshed!');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }

    setupAutoRefresh() {
        // Auto-refresh every 5 minutes if user has membership
        if (this.user?.walletAddress) {
            setInterval(() => {
                this.refreshData();
            }, 5 * 60 * 1000);
        }
    }

    // UI Enhancement Functions
    initTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', this.showTooltip.bind(this));
            element.addEventListener('mouseleave', this.hideTooltip.bind(this));
        });
    }

    showTooltip(event) {
        const element = event.target;
        const text = element.dataset.tooltip;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    }

    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    initLazyLoading() {
        const lazyElements = document.querySelectorAll('[data-lazy]');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        element.src = element.dataset.lazy;
                        element.classList.remove('lazy');
                        observer.unobserve(element);
                    }
                });
            });
            
            lazyElements.forEach(element => observer.observe(element));
        }
    }

    initAnimations() {
        // Animate elements on scroll
        const animateElements = document.querySelectorAll('[data-animate]');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animated');
                    }
                });
            });
            
            animateElements.forEach(element => observer.observe(element));
        }
    }

    highlightCurrentNavItem() {
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
            }
        });
    }

    showWalletPrompt() {
        // Show a subtle prompt to connect wallet
        const prompt = document.createElement('div');
        prompt.className = 'wallet-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <span>Connect your wallet to access all features</span>
                <button onclick="app.connectWallet()" class="prompt-btn">Connect</button>
                <button onclick="this.parentElement.parentElement.remove()" class="prompt-close">×</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
    }

    // Utility function to format numbers
    formatNumber(num, decimals = 2) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(decimals) + 'K';
        }
        return num.toLocaleString();
    }

    // Utility function to format wallet address
    formatAddress(address, start = 6, end = 4) {
        if (!address) return '';
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CryptoMembershipApp();
});

// Global helper functions
function copyText(text) {
    window.app.copyToClipboard(text);
}

function openModal(modalId) {
    window.app.openModal(modalId);
}

function closeModal(modalId) {
    window.app.closeModal(modalId);
}

function refreshData() {
    window.app.refreshData();
}