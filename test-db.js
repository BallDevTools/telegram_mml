// test-db.js
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        console.log('URI:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        
        // ทดสอบสร้างข้อมูล
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('📁 Available collections:', collections.map(c => c.name));
        
        // ทดสอบ query
        const usersCount = await db.collection('users').countDocuments();
        const membershipsCount = await db.collection('memberships').countDocuments();
        
        console.log('👥 Users count:', usersCount);
        console.log('🎫 Memberships count:', membershipsCount);
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB Atlas');
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

testConnection();