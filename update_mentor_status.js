import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function updateMentorStatus() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);

    // Update all mentors to be online
    const result = await db
      .collection("mentors")
      .updateMany({}, { $set: { onlineStatus: true } });

    console.log(`Updated ${result.modifiedCount} mentors to online status`);

    // Verify the update
    const mentors = await db.collection("mentors").find({}).toArray();
    console.log("\nCurrent mentor statuses:");
    mentors.forEach((mentor) => {
      console.log(
        `${mentor.name} (${mentor.email}): ${
          mentor.onlineStatus ? "Online" : "Offline"
        }`
      );
    });

    await client.close();
  } catch (error) {
    console.error("Error updating mentor status:", error);
  }
}

updateMentorStatus();
