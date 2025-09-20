const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://gamingworld448:VD6Us86aukIKOcST@cluster0.hxoebiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = process.env.DB_NAME || "project";

// Define the Mentor schema
const mentorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ["mentee", "mentor"] },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    profileCompleted: { type: Boolean, default: false },
    fieldOfInterest: { type: String },
    yearOfExperience: { type: Number },
    skills: { type: [String] },
    availability: { type: String },
    briefBio: { type: String },
    education: { type: String },
    expertise: { type: [String] },
    specializations: { type: [String] },
    preferredTimeSlots: { type: [String] },
    maxSessions: { type: Number, default: 5 },
    sessionDuration: { type: Number, default: 60 },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    rating: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    subject_breakdown: {
      results: [
        {
          subject: { type: String },
          percentage: { type: Number },
        },
      ],
    },
    processed_data: {
      basic_info: {
        name: String,
        email: String,
        is_online: Boolean,
        last_active: Date,
      },
      expertise: {
        job_role: String,
        skills: [String],
        education: String,
        experience: Number,
        specializations: [String],
      },
      availability: {
        available_hours: Number,
        preferred_time_slots: [String],
        timezone: String,
      },
      location: {
        country: String,
        city: String,
        timezone: String,
      },
      workload: {
        current_sessions: Number,
        max_sessions: Number,
        session_duration: Number,
      },
      matching_metrics: {
        skill_match_score: Number,
        experience_match_score: Number,
        availability_match_score: Number,
        location_match_score: Number,
        workload_score: Number,
        subject_match_score: Number,
        total_compatibility_score: Number,
      },
    },
    profile_status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    profile_completed_at: { type: Date },
    last_updated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

async function createMentorDirect() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Create the Mentor model
    const Mentor = mongoose.model("Mentor", mentorSchema);

    // Check if mentor already exists
    const existingMentor = await Mentor.findOne({ email: "mentor@test.com" });

    if (existingMentor) {
      console.log("Mentor already exists, updating profile...");

      // Update the existing mentor
      existingMentor.profileCompleted = true;
      existingMentor.profile_status = "completed";
      existingMentor.profile_completed_at = new Date();
      await existingMentor.save();

      console.log("Mentor profile updated successfully");
      console.log("Mentor ID:", existingMentor._id);
    } else {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("password123", salt);

      // Create a new mentor
      const currentTime = new Date();
      const mentor = new Mentor({
        name: "Test Mentor",
        email: "mentor@test.com",
        password: hashedPassword,
        role: "mentor",
        phone: "1234567890",
        address: "Test Address",
        profileCompleted: true,
        fieldOfInterest: "Computer Science",
        yearOfExperience: 5,
        skills: ["Python", "JavaScript", "Node.js", "MongoDB"],
        availability: "Weekdays 9AM-5PM",
        briefBio: "Test mentor for testing purposes",
        education: "Bachelor of Science in Computer Science",
        expertise: ["Web Development", "Database Design"],
        specializations: ["Full Stack Development"],
        preferredTimeSlots: ["Morning", "Evening"],
        maxSessions: 5,
        sessionDuration: 60,
        isOnline: true,
        lastActive: currentTime,
        rating: 5.0,
        totalSessions: 0,
        subject_breakdown: {
          results: [
            { subject: "Computer Science", percentage: 100 },
            { subject: "Web Development", percentage: 90 },
            { subject: "Database Design", percentage: 85 },
          ],
        },
        processed_data: {
          basic_info: {
            name: "Test Mentor",
            email: "mentor@test.com",
            is_online: true,
            last_active: currentTime,
          },
          expertise: {
            job_role: "Software Developer",
            skills: ["Python", "JavaScript", "Node.js", "MongoDB"],
            education: "Bachelor of Science in Computer Science",
            experience: 5,
            specializations: ["Full Stack Development"],
          },
          availability: {
            available_hours: 8,
            preferred_time_slots: ["Morning", "Evening"],
            timezone: "UTC",
          },
          location: {
            country: "India",
            city: "Mumbai",
            timezone: "UTC+5:30",
          },
          workload: {
            current_sessions: 0,
            max_sessions: 5,
            session_duration: 60,
          },
          matching_metrics: {
            skill_match_score: 90,
            experience_match_score: 85,
            availability_match_score: 100,
            location_match_score: 100,
            workload_score: 100,
            subject_match_score: 90,
            total_compatibility_score: 94,
          },
        },
        profile_status: "completed",
        profile_completed_at: currentTime,
        last_updated: currentTime,
      });

      // Save the mentor
      await mentor.save();

      console.log("Mentor profile created successfully");
      console.log("Mentor ID:", mentor._id);
    }

    // Verify the mentor exists
    const verifiedMentor = await Mentor.findOne({ email: "mentor@test.com" });
    console.log("Verification - Mentor exists:", !!verifiedMentor);
    if (verifiedMentor) {
      console.log(
        "Verification - Profile completed:",
        verifiedMentor.profileCompleted
      );
      console.log(
        "Verification - Profile status:",
        verifiedMentor.profile_status
      );
    }

    // Close the connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed");

    console.log("\nYou can now log in with:");
    console.log("Email: mentor@test.com");
    console.log("Password: password123");
    console.log("Role: mentor");
  } catch (error) {
    console.error("Error creating mentor profile:", error);
  }
}

// Run the function
createMentorDirect();
