// scripts/eventListener.js - Standalone event listener for PM2
require('dotenv').config();

// Check if this should run as separate process
if (process.env.PROCESS_TYPE !== 'event_listener') {
    console.log('⚠️  This script is designed to run as a separate event listener process');
    process.exit(0);
}

const mongoose = require('mongoose');
const ContractEventListener = require('../src/services/eventListener');

class StandaloneEventListener {
    constructor() {
        this.eventListener = null;
        this.isShuttingDown = false;
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🎧 Starting Standalone Event Listener...');
            
            // Connect to database
            await this.connectDatabase();
            
            // Initialize event listener
            this.eventListener = new ContractEventListener();
            
            // Setup graceful shutdown
            this.setupShutdown();
            
            console.log('✅ Standalone Event Listener initialized successfully');
            
            // Health check interval
            setInterval(() => {
                this.healthCheck();
            }, 60000); // Every minute
            
        } catch (error) {
            console.error('❌ Failed to initialize event listener:', error);
            process.exit(1);
        }
    }
    
    async connectDatabase() {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 5, // Smaller pool for event listener
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            
            console.log('📊 Event Listener connected to database');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }
    
    healthCheck() {
        if (this.isShuttingDown) return;
        
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        console.log(`🏥 Health Check: Memory: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Uptime: ${Math.round(uptime)}s`);
        
        // Restart if memory usage is too high
        if (memUsage.rss > 500 * 1024 * 1024) { // 500MB
            console.log('⚠️  High memory usage detected, restarting...');
            this.gracefulShutdown();
        }
    }
    
    setupShutdown() {
        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
                this.gracefulShutdown();
            });
        });
        
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            this.gracefulShutdown();
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown();
        });
    }
    
    async gracefulShutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        
        console.log('🛑 Gracefully shutting down event listener...');
        
        try {
            // Stop event listener
            if (this.eventListener) {
                this.eventListener.stop();
            }
            
            // Close database connection
            await mongoose.connection.close();
            console.log('📊 Database connection closed');
            
            console.log('✅ Event listener shut down complete');
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        } finally {
            process.exit(0);
        }
    }
}

// Start the standalone event listener
new StandaloneEventListener();