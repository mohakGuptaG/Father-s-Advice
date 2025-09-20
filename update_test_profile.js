require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Mentor = require('./models/mentor.model.js');

async function updateTestProfile() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find or create test mentor
        let mentor = await Mentor.findOne({ email: 'testmentor@example.com' });
        if (!mentor) {
            console.log('Creating new test mentor...');
            const hashedPassword = await bcrypt.hash('test123', 10);
            mentor = new Mentor({
                name: 'Test Mentor',
                email: 'testmentor@example.com',
                password: hashedPassword,
                role: 'mentor',
                phone: '1234567890',
                address: 'Test Address'
            });
            mentor = await mentor.save();
        }

        // Update mentor profile
        const updatedMentor = await Mentor.findByIdAndUpdate(
            mentor._id,
            {
                $set: {
                    fieldOfInterest: 'Software Engineering',
                    yearOfExperience: 5,
                    skills: ['JavaScript', 'Python', 'Node.js', 'React', 'MongoDB'],
                    availability: 'Available 9 AM - 6 PM IST',
                    briefBio: 'Experienced software engineer with expertise in full-stack development',
                    education: 'B.Tech in Computer Science',
                    expertise: ['Web Development', 'Database Design', 'API Development'],
                    specializations: ['Full Stack Development', 'Cloud Computing'],
                    preferredTimeSlots: ['Morning', 'Evening'],
                    maxSessions: 5,
                    sessionDuration: 60,
                    isOnline: true,
                    lastActive: new Date(),
                    profileCompleted: true
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedMentor) {
            throw new Error('Failed to update mentor profile');
        }

        console.log('Test profile updated successfully:', {
            id: updatedMentor._id,
            email: updatedMentor.email,
            profileCompleted: updatedMentor.profileCompleted
        });

        // Verify the update
        const verifiedMentor = await Mentor.findById(mentor._id);
        console.log('Verified mentor profile:', {
            id: verifiedMentor._id,
            profileCompleted: verifiedMentor.profileCompleted
        });

    } catch (error) {
        console.error('Error updating test profile:', error);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run the update function
updateTestProfile(); 