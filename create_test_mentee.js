const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user.model');
require('dotenv').config();

// MongoDB connection URL from .env
const MONGODB_URI = process.env.MONGO_URI;

async function createTestMentee() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if test mentee already exists
        const existingUser = await User.findOne({ email: 'test.mentee@example.com' });
        if (existingUser) {
            console.log('Test mentee already exists');
            await mongoose.disconnect();
            return;
        }

        // Create test mentee
        const hashedPassword = await bcrypt.hash('test123', 10);
        const testMentee = new User({
            name: 'Test Mentee',
            email: 'test.mentee@example.com',
            password: hashedPassword,
            role: 'mentee',
            phone: '1234567890',
            address: '123 Test Street'
        });

        await testMentee.save();
        console.log('Test mentee created successfully');
        console.log('Email: test.mentee@example.com');
        console.log('Password: test123');

    } catch (error) {
        console.error('Error creating test mentee:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createTestMentee(); 