// public/js/telegram.js
class TelegramManager {
    constructor() {
        this.webApp = window.Telegram?.WebApp;
        this.user = null;
        this.theme = 'light';
        
        this.init();
    }
    
    init() {
        if (this.webApp) {
            this.webApp.ready();
            this.webApp.expand();
            
            // Get user data
            this.user = this.webApp.initDataUnsafe?.user || null;
            this.theme = this.webApp.colorScheme || 'light';
            
            // Set theme
            this.applyTheme();
            
            // Configure main button
            this.setupMainButton();
            
            // Handle back button
            this.setupBackButton();
            
            // Set viewport height
            this.setViewportHeight();
            
            console.log('Telegram Web App initialized:', this.user);
        }
    }
    
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Apply Telegram theme colors
        const root = document.documentElement;
        if (this.webApp.themeParams) {
            root.style.setProperty('--tg-bg-color', this.webApp.themeParams.bg_color || '#ffffff');
            root.style.setProperty('--tg-text-color', this.webApp.themeParams.text_color || '#000000');
            root.style.setProperty('--tg-hint-color', this.webApp.themeParams.hint_color || '#999999');
            root.style.setProperty('--tg-link-color', this.webApp.themeParams.link_color || '#2481cc');
            root.style.setProperty('--tg-button-color', this.webApp.themeParams.button_color || '#2481cc');
            root.style.setProperty('--tg-button-text-color', this.webApp.themeParams.button_text_color || '#ffffff');
        }
    }
    
    setupMainButton() {
        if (!this.webApp) return;
        
        // Hide main button by default
        this.webApp.MainButton.hide();
        
        // Configure main button
        this.webApp.MainButton.setParams({
            text: 'Continue',
            color: this.webApp.themeParams.button_color || '#2481cc',
            text_color: this.webApp.themeParams.button_text_color || '#ffffff'
        });
    }
    
    setupBackButton() {
        if (!this.webApp) return;
        
        this.webApp.BackButton.onClick(() => {
            // Handle back button
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/';
            }
        });
    }
    
    setViewportHeight() {
        // Fix viewport height for mobile
        const vh = this.webApp?.viewportHeight || window.innerHeight;
        document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
    }
    
    showMainButton(text, onClick) {
        if (!this.webApp) return;
        
        this.webApp.MainButton.setText(text);
        this.webApp.MainButton.onClick(onClick);
        this.webApp.MainButton.show();
    }
    
    hideMainButton() {
        if (this.webApp) {
            this.webApp.MainButton.hide();
        }
    }
    
    showBackButton() {
        if (this.webApp) {
            this.webApp.BackButton.show();
        }
    }
    
    hideBackButton() {
        if (this.webApp) {
            this.webApp.BackButton.hide();
        }
    }
    
    showAlert(message) {
        if (this.webApp) {
            this.webApp.showAlert(message);
        } else {
            alert(message);
        }
    }
    
    showConfirm(message, callback) {
        if (this.webApp) {
            this.webApp.showConfirm(message, callback);
        } else {
            const result = confirm(message);
            callback(result);
        }
    }
    
    openLink(url, options = {}) {
        if (this.webApp) {
            this.webApp.openLink(url, options);
        } else {
            window.open(url, '_blank');
        }
    }
    
    shareInlineQuery(text, types = ['users']) {
        if (this.webApp) {
            this.webApp.switchInlineQuery(text, types);
        }
    }
    
    hapticFeedback(type = 'light') {
        if (this.webApp?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.webApp.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.webApp.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.webApp.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'error':
                    this.webApp.HapticFeedback.notificationOccurred('error');
                    break;
                case 'success':
                    this.webApp.HapticFeedback.notificationOccurred('success');
                    break;
                case 'warning':
                    this.webApp.HapticFeedback.notificationOccurred('warning');
                    break;
            }
        }
    }
    
    close() {
        if (this.webApp) {
            this.webApp.close();
        }
    }
    
    sendData(data) {
        if (this.webApp) {
            this.webApp.sendData(JSON.stringify(data));
        }
    }
}

// Initialize Telegram Manager
window.telegramManager = new TelegramManager();

// Listen for theme changes
window.addEventListener('load', () => {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.onEvent('themeChanged', () => {
            window.telegramManager.applyTheme();
        });
        
        window.Telegram.WebApp.onEvent('viewportChanged', () => {
            window.telegramManager.setViewportHeight();
        });
    }
});