const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://gamingworld448:VD6Us86aukIKOcST@cluster0.hxoebiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = process.env.DB_NAME || "project";

async function checkMentorDB() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Get the mentors collection
    const db = mongoose.connection.db;
    const mentorsCollection = db.collection("mentors");

    // Find the mentor with email mentor@test.com
    const mentor = await mentorsCollection.findOne({
      email: "mentor@test.com",
    });

    if (mentor) {
      console.log("Mentor found in database:");
      console.log("ID:", mentor._id);
      console.log("Name:", mentor.name);
      console.log("Email:", mentor.email);
      console.log("Role:", mentor.role);
      console.log("Profile Completed:", mentor.profileCompleted);
      console.log("Profile Status:", mentor.profile_status);

      // Check if password is hashed
      if (mentor.password && typeof mentor.password === "string") {
        console.log("Password is stored as a string");
        if (mentor.password.startsWith("$2")) {
          console.log("Password appears to be bcrypt hashed");
        } else {
          console.log("Password is NOT bcrypt hashed!");
        }
      } else {
        console.log("Password field is missing or not a string");
      }
    } else {
      console.log("Mentor not found in database");

      // List all mentors in the database
      const allMentors = await mentorsCollection.find({}).toArray();
      console.log(`Found ${allMentors.length} mentors in the database:`);
      allMentors.forEach((m, i) => {
        console.log(`${i + 1}. ${m.name} (${m.email})`);
      });
    }

    // Close the connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (error) {
    console.error("Error checking mentor database:", error);
  }
}

// Run the function
checkMentorDB();
