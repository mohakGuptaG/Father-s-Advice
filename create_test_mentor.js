require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const Mentor = require('./models/mentor.model.js');

async function createTestMentor() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Create test mentor profile data
        const testMentorData = {
            name: 'Test Mentor',
            email: 'testmentor@example.com',
            password: await bcrypt.hash('test123', 10),
            role: 'mentor',
            phone: '1234567890',
            address: 'Test Address',
            fieldOfInterest: 'Software Engineering',
            yearOfExperience: 5,
            skills: ['JavaScript', 'Python', 'Node.js', 'React', 'MongoDB', 'Express', 'SQL'],
            availability: 'Available 9 AM - 6 PM IST',
            briefBio: 'Experienced software engineer with expertise in full-stack development and cloud computing',
            education: 'B.Tech in Computer Science',
            expertise: ['Web Development', 'Database Design', 'API Development', 'Cloud Computing'],
            specializations: ['Full Stack Development', 'Cloud Computing', 'DevOps'],
            preferredTimeSlots: ['Morning', 'Evening'],
            maxSessions: 5,
            sessionDuration: 60,
            isOnline: true,
            lastActive: new Date(),
            rating: 0,
            totalSessions: 0,
            uploadResume: 'https://example.com/test-resume.pdf', // Example resume URL
            profileCompleted: true
        };

        // Find existing mentor or create new one
        let mentor = await Mentor.findOne({ email: testMentorData.email });
        
        if (mentor) {
            console.log('Updating existing test mentor:', mentor._id);
            mentor = await Mentor.findByIdAndUpdate(
                mentor._id,
                testMentorData,
                { new: true, runValidators: true }
            );
        } else {
            console.log('Creating new test mentor');
            mentor = await new Mentor(testMentorData).save();
        }

        console.log('Test mentor saved successfully:', {
            id: mentor._id,
            email: mentor.email,
            profileCompleted: mentor.profileCompleted
        });

        // Send profile data to mentor processor
        try {
            const processorResponse = await axios.post('http://localhost:5003/process_mentor_profile', {
                mentor_id: mentor._id.toString(),
                mentor_data: {
                    basic_info: {
                        name: mentor.name,
                        email: mentor.email,
                        is_online: mentor.isOnline,
                        last_active: mentor.lastActive
                    },
                    expertise: {
                        job_role: mentor.fieldOfInterest,
                        skills: mentor.skills,
                        education: mentor.education,
                        experience: mentor.yearOfExperience,
                        specializations: mentor.specializations
                    },
                    availability: {
                        available_hours: 8, // Default to 8 hours per day
                        preferred_time_slots: mentor.preferredTimeSlots,
                        timezone: "UTC"
                    },
                    location: {
                        country: "India",
                        city: "Mumbai",
                        timezone: "UTC"
                    },
                    workload: {
                        current_sessions: 0,
                        max_sessions: mentor.maxSessions,
                        session_duration: mentor.sessionDuration
                    }
                }
            });

            if (processorResponse.data.error) {
                throw new Error(processorResponse.data.error);
            }

            console.log('Profile processed successfully by mentor processor');
            
            // Verify final state in database
            const verifiedMentor = await Mentor.findById(mentor._id);
            console.log('Final mentor state:', {
                id: verifiedMentor._id,
                email: verifiedMentor.email,
                profileCompleted: verifiedMentor.profileCompleted,
                processedData: !!verifiedMentor.processedData
            });
        } catch (error) {
            console.error('Error with mentor processor:', error.message);
            throw error;
        }

        return mentor;
    } catch (error) {
        console.error('Error creating test mentor:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
createTestMentor()
    .then(() => {
        console.log('Test mentor creation completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to create test mentor:', error);
        process.exit(1);
    }); 