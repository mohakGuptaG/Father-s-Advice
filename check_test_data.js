import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

async function checkTestData() {
  try {
    // Check mentors
    const mentors = await Mentor.find({});
    console.log(`\nFound ${mentors.length} mentors:`);
    for (const mentor of mentors) {
      console.log(`\n${mentor.name} (${mentor.email}):`);
      console.log("Field of Interest:", mentor.fieldOfInterest);
      console.log("Skills:", mentor.skills);
      console.log("Expertise:", mentor.expertise);
      console.log("Is Online:", mentor.isOnline);
      console.log("Rating:", mentor.rating);
      console.log("Total Sessions:", mentor.totalSessions);
      console.log(
        "Subject Breakdown:",
        JSON.stringify(mentor.subject_breakdown, null, 2)
      );
      console.log("Profile Status:", mentor.profile_status);
    }

    // Check mentees
    const mentees = await User.find({ role: "mentee" });
    console.log(`\nFound ${mentees.length} mentees:`);
    for (const mentee of mentees) {
      console.log(`\n${mentee.name} (${mentee.email}):`);
      console.log("Field of Interest:", mentee.fieldOfInterest);
      console.log("Current Doubt:", mentee.currentDoubt);
      console.log(
        "Subject Breakdown:",
        JSON.stringify(mentee.subjectBreakdown, null, 2)
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("Error checking test data:", error);
    process.exit(1);
  }
}

async function main() {
  await connectToMongoDB();
  await checkTestData();
}

main();
