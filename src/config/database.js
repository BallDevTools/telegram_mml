// src/config/database.js - แก้ไข connection
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        
        // ซ่อน password ใน log
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
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
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
        
        // แสดง error details เฉพาะใน development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error details:', error);
        }
        
        // ไม่ exit process ให้ app รันต่อได้
        console.log('⚠️  Continuing without database connection...');
    }
};

// เรียกใช้ connectDB
connectDB();

module.exports = connectDB;