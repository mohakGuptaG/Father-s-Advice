import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function checkMentorData() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);

    // Get all mentors
    const mentors = await db.collection("mentors").find({}).toArray();

    console.log("Found", mentors.length, "mentors");
    mentors.forEach((mentor) => {
      console.log("\nMentor:", mentor.name);
      console.log("Email:", mentor.email);
      console.log("Online Status Fields:");
      console.log("- isOnline:", mentor.isOnline);
      console.log("- is_online:", mentor.is_online);
      console.log("- onlineStatus:", mentor.onlineStatus);
    });

    await client.close();
  } catch (error) {
    console.error("Error checking mentor data:", error);
  }
}

checkMentorData();
