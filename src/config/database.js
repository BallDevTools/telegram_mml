// src/config/database.js - เพิ่ม fallback mechanism

const mongoose = require('mongoose');

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds

const connectDB = async () => {
    if (isConnected) {
        console.log('📊 Database already connected');
        return;
    }

    try {
        connectionAttempts++;
        console.log(`🔌 Connecting to MongoDB... (Attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS})`);
        
        const uriForLog = process.env.MONGODB_URI 
            ? process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
            : 'URI not configured';
        console.log('📍 URI:', uriForLog);
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000, // เพิ่มเวลา timeout
            socketTimeoutMS: 45000,
            family: 4,
            retryWrites: true,
            retryReads: true
        });

        isConnected = true;
        connectionAttempts = 0; // reset on successful connection

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
            isConnected = false;
            
            // Auto-reconnect
            setTimeout(() => {
                if (!isConnected && connectionAttempts < MAX_RETRY_ATTEMPTS) {
                    connectDB();
                }
            }, RETRY_DELAY);
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
            isConnected = true;
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            await mongoose.connection.close();
            console.log('🔌 MongoDB connection closed through app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        isConnected = false;
        
        // แสดง error details เฉพาะใน development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error details:', error);
        }
        
        // Retry connection
        if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
            console.log(`🔄 Retrying connection in ${RETRY_DELAY/1000} seconds...`);
            setTimeout(() => {
                connectDB();
            }, RETRY_DELAY);
        } else {
            console.log('⚠️  Max connection attempts reached. Continuing without database...');
            console.log('💡 Tips to fix:');
            console.log('   1. Check your IP whitelist in MongoDB Atlas');
            console.log('   2. Verify MONGODB_URI in .env file');
            console.log('   3. Check network connectivity');
        }
    }
};

// Export connection status checker
const isDatabaseConnected = () => isConnected;

// Export connection function
const reconnectDatabase = async () => {
    if (!isConnected && connectionAttempts < MAX_RETRY_ATTEMPTS) {
        await connectDB();
    }
};

// เรียกใช้ connectDB
connectDB();

module.exports = { connectDB, isDatabaseConnected, reconnectDatabase };