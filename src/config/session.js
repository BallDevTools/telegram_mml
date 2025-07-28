// src/config/session.js
const MongoStore = require('connect-mongo');

function createSessionConfig() {
    const config = {
        secret: process.env.SESSION_SECRET || 'crypto-membership-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
        },
        name: 'crypto.session.id'
    };

    // Use MongoDB store if available
    if (process.env.MONGODB_URI) {
        try {
            config.store = MongoStore.create({
                mongoUrl: process.env.MONGODB_URI,
                touchAfter: 24 * 3600, // lazy session update
                crypto: {
                    secret: process.env.SESSION_SECRET || 'crypto-membership-secret-key'
                }
            });
            console.log('✅ Using MongoDB session store');
        } catch (error) {
            console.warn('⚠️  MongoDB session store failed, using memory store:', error.message);
        }
    } else {
        console.warn('⚠️  No MongoDB URI found, using memory store (not recommended for production)');
    }

    return config;
}

module.exports = createSessionConfig;