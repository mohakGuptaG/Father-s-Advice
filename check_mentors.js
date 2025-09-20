import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function checkMentors() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);

    // Get all mentors
    const mentors = await db.collection("mentors").find({}).toArray();

    console.log(`Found ${mentors.length} mentors:`);
    mentors.forEach((mentor) => {
      console.log("\nMentor Details:");
      console.log("ID:", mentor._id);
      console.log("Name:", mentor.name);
      console.log("Email:", mentor.email);
      console.log("Online Status:", mentor.isOnline);
      console.log("Skills:", mentor.skills);
      console.log("Field of Interest:", mentor.fieldOfInterest);
      console.log("Subject Breakdown:", mentor.subject_breakdown);
    });

    await client.close();
  } catch (error) {
    console.error("Error checking mentors:", error);
  }
}

checkMentors();
