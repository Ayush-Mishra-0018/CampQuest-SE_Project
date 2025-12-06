const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup function to be called before all tests
const setupTestDB = async () => {
    try {
        // Close any existing connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        // Create in-memory MongoDB instance
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Connect to the in-memory database
        await mongoose.connect(mongoUri);
        console.log('✅ Test database connected');
    } catch (error) {
        console.error('❌ Test database setup failed:', error);
        throw error;
    }
};

// Teardown function to be called after all tests
const teardownTestDB = async () => {
    try {
        // Drop all collections
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        // Disconnect and stop the server
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('✅ Test database disconnected');
    } catch (error) {
        console.error('❌ Test database teardown failed:', error);
        throw error;
    }
};

// Clear all collections between tests
const clearTestDB = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};

module.exports = {
    setupTestDB,
    teardownTestDB,
    clearTestDB
};
