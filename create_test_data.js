import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function createTestData() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);

    // Clear existing data
    await db.collection("mentors").deleteMany({});
    await db.collection("mentees").deleteMany({});

    // Create test mentor
    const mentorResult = await db.collection("mentors").insertOne({
      name: "Test Mentor",
      email: "testmentor@example.com",
      password: "hashedpassword123",
      role: "mentor",
      phone: "1234567890",
      address: "123 Test St",
      profileCompleted: true,
      fieldOfInterest: "Computer Science",
      yearOfExperience: 5,
      skills: ["Python", "Data Structures", "Algorithms"],
      availability: "Flexible",
      briefBio:
        "Experienced software engineer with expertise in algorithms and data structures.",
      education: "MS in Computer Science",
      expertise: ["Programming", "Data Structures", "Algorithms"],
      specializations: ["Python", "Java", "C++"],
      preferredTimeSlots: ["Morning", "Evening"],
      maxSessions: 5,
      sessionDuration: 60,
      isOnline: true,
      onlineStatus: true,
      is_online: true,
      lastActive: new Date(),
      rating: 4.5,
      totalSessions: 10,
      subject_breakdown: {
        results: [
          {
            subject: "Data Structures",
            percentage: 85,
          },
          {
            subject: "Algorithms",
            percentage: 90,
          },
          {
            subject: "Python",
            percentage: 95,
          },
          {
            subject: "Binary Trees",
            percentage: 80,
          },
        ],
      },
    });

    // Create test mentee
    const menteeResult = await db.collection("mentees").insertOne({
      name: "Test Mentee",
      email: "testmentee@example.com",
      password: "hashedpassword123",
      role: "mentee",
      phone: "0987654321",
      address: "456 Test Ave",
      currentDoubt: "How do I implement a binary search tree in Python?",
      fieldOfInterest: "Computer Science",
      subject_breakdown: {
        results: [
          {
            subject: "Data Structures",
            percentage: 60,
          },
          {
            subject: "Algorithms",
            percentage: 50,
          },
          {
            subject: "Python",
            percentage: 70,
          },
          {
            subject: "Binary Trees",
            percentage: 40,
          },
        ],
      },
    });

    console.log("Test data created successfully");
    console.log("Mentor ID:", mentorResult.insertedId);
    console.log("Mentee ID:", menteeResult.insertedId);

    await client.close();
  } catch (error) {
    console.error("Error creating test data:", error);
  }
}

createTestData();
