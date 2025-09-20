import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Import models
const Mentor = (await import("./models/mentor.model.js")).default;
const User = (await import("./models/user.model.js")).default;

async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

async function cleanDatabase() {
  try {
    // Drop all collections
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.drop();
    }
    console.log("Database cleaned successfully");
  } catch (error) {
    console.error("Error cleaning database:", error);
    process.exit(1);
  }
}

async function createTestMentors() {
  try {
    const mentors = [
      {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        role: "mentor",
        phone: "1234567890",
        address: "123 Main St",
        fieldOfInterest: "Computer Science, Mathematics",
        yearOfExperience: 5,
        skills: ["Python", "Java", "Data Structures"],
        availability: JSON.stringify({
          monday: ["09:00-12:00", "14:00-17:00"],
          tuesday: ["09:00-12:00", "14:00-17:00"],
          wednesday: ["09:00-12:00", "14:00-17:00"],
          thursday: ["09:00-12:00", "14:00-17:00"],
          friday: ["09:00-12:00", "14:00-17:00"],
        }),
        briefBio: "Experienced software developer with a passion for teaching",
        education: "Masters in Computer Science",
        expertise: ["Web Development", "Database Design", "API Development"],
        specializations: ["Full Stack Development", "Cloud Computing"],
        preferredTimeSlots: ["09:00-12:00", "14:00-17:00"],
        maxSessions: 5,
        sessionDuration: 60,
        isOnline: true,
        rating: 4.5,
        totalSessions: 10,
        subject_breakdown: {
          results: [
            { subject: "Computer Science", percentage: 90 },
            { subject: "Mathematics", percentage: 80 },
            { subject: "Web Development", percentage: 95 },
          ],
        },
        processed_data: {
          basic_info: {
            name: "John Doe",
            email: "john@example.com",
            is_online: true,
            last_active: new Date(),
          },
          expertise: {
            job_role: "Senior Software Developer",
            skills: ["Python", "Java", "Data Structures"],
            education: "Masters in Computer Science",
            experience: 5,
            specializations: ["Full Stack Development", "Cloud Computing"],
          },
          availability: {
            available_hours: 40,
            preferred_time_slots: ["09:00-12:00", "14:00-17:00"],
            timezone: "UTC",
          },
          location: {
            country: "USA",
            city: "New York",
            timezone: "UTC-5",
          },
          workload: {
            current_sessions: 3,
            max_sessions: 5,
            session_duration: 60,
          },
          matching_metrics: {
            skill_match_score: 0.9,
            experience_match_score: 0.85,
            availability_match_score: 0.95,
            location_match_score: 0.8,
            workload_score: 0.9,
            subject_match_score: 0.95,
            total_compatibility_score: 0.9,
          },
        },
        profile_status: "completed",
        profile_completed_at: new Date(),
        last_updated: new Date(),
      },
      {
        name: "Jane Smith",
        email: "jane@example.com",
        password: "password123",
        role: "mentor",
        phone: "9876543210",
        address: "456 Oak St",
        fieldOfInterest: "Physics, Chemistry",
        yearOfExperience: 8,
        skills: ["Physics", "Chemistry", "Laboratory Techniques"],
        availability: JSON.stringify({
          monday: ["10:00-13:00", "15:00-18:00"],
          tuesday: ["10:00-13:00", "15:00-18:00"],
          wednesday: ["10:00-13:00", "15:00-18:00"],
          thursday: ["10:00-13:00", "15:00-18:00"],
          friday: ["10:00-13:00", "15:00-18:00"],
        }),
        briefBio: "Experienced science educator with research background",
        education: "PhD in Physics",
        expertise: ["Physics", "Chemistry", "Laboratory Techniques"],
        specializations: ["Quantum Mechanics", "Organic Chemistry"],
        preferredTimeSlots: ["10:00-13:00", "15:00-18:00"],
        maxSessions: 4,
        sessionDuration: 90,
        isOnline: true,
        rating: 4.8,
        totalSessions: 15,
        subject_breakdown: {
          results: [
            { subject: "Physics", percentage: 95 },
            { subject: "Chemistry", percentage: 90 },
            { subject: "Laboratory Techniques", percentage: 85 },
          ],
        },
        processed_data: {
          basic_info: {
            name: "Jane Smith",
            email: "jane@example.com",
            is_online: true,
            last_active: new Date(),
          },
          expertise: {
            job_role: "Research Scientist",
            skills: ["Physics", "Chemistry", "Laboratory Techniques"],
            education: "PhD in Physics",
            experience: 8,
            specializations: ["Quantum Mechanics", "Organic Chemistry"],
          },
          availability: {
            available_hours: 35,
            preferred_time_slots: ["10:00-13:00", "15:00-18:00"],
            timezone: "UTC",
          },
          location: {
            country: "USA",
            city: "Boston",
            timezone: "UTC-5",
          },
          workload: {
            current_sessions: 2,
            max_sessions: 4,
            session_duration: 90,
          },
          matching_metrics: {
            skill_match_score: 0.95,
            experience_match_score: 0.9,
            availability_match_score: 0.85,
            location_match_score: 0.85,
            workload_score: 0.95,
            subject_match_score: 0.9,
            total_compatibility_score: 0.92,
          },
        },
        profile_status: "completed",
        profile_completed_at: new Date(),
        last_updated: new Date(),
      },
    ];

    await Mentor.insertMany(mentors);
    console.log("Test mentors created successfully");
  } catch (error) {
    console.error("Error creating test mentors:", error);
    process.exit(1);
  }
}

async function createTestMentees() {
  try {
    const mentees = [
      {
        name: "Alice Johnson",
        email: "alice@example.com",
        password: "password123",
        role: "mentee",
        phone: "1112223333",
        address: "789 Pine St",
        fieldOfInterest: "Computer Science",
        currentDoubt: "How do I implement a binary search tree in Python?",
        subjectBreakdown: {
          results: [
            { subject: "Computer Science", percentage: 70 },
            { subject: "Data Structures", percentage: 60 },
          ],
        },
      },
      {
        name: "Bob Wilson",
        email: "bob@example.com",
        password: "password123",
        role: "mentee",
        phone: "4445556666",
        address: "321 Elm St",
        fieldOfInterest: "Physics",
        currentDoubt: "Can you explain Newton's laws of motion?",
        subjectBreakdown: {
          results: [
            { subject: "Physics", percentage: 65 },
            { subject: "Mechanics", percentage: 60 },
          ],
        },
      },
    ];

    await User.insertMany(mentees);
    console.log("Test mentees created successfully");
  } catch (error) {
    console.error("Error creating test mentees:", error);
    process.exit(1);
  }
}

async function main() {
  await connectToMongoDB();
  await cleanDatabase();
  await createTestMentors();
  await createTestMentees();
  console.log("Test data creation completed");
  process.exit(0);
}

main();
