import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function getMenteeId() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);
    const mentee = await db
      .collection("mentees")
      .findOne({ email: "testmentee@example.com" });
    await client.close();

    if (!mentee) {
      console.error("Could not find mentee with email testmentee@example.com");
      return null;
    }

    console.log("Found mentee:", {
      id: mentee._id,
      name: mentee.name,
      email: mentee.email,
      subject_breakdown: mentee.subject_breakdown,
    });

    return mentee._id.toString();
  } catch (error) {
    console.error("Error getting mentee ID:", error);
    return null;
  }
}

async function testSubmitDoubt() {
  try {
    // Get the mentee ID from the database
    const menteeId = await getMenteeId();
    if (!menteeId) {
      console.error("Could not find mentee with email testmentee@example.com");
      return;
    }

    const doubtText =
      "How do I implement a binary search tree in Python? I understand the basic concept of binary trees, but I'm having trouble with the insertion and deletion operations.";

    console.log("Submitting doubt...");
    console.log("Mentee ID:", menteeId);
    console.log("Doubt Text:", doubtText);

    const response = await axios.post("http://localhost:5001/submit_doubt", {
      mentee_id: menteeId,
      doubt: doubtText,
    });

    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    if (error.code === "ECONNREFUSED") {
      console.error(
        "Could not connect to the API server. Make sure it is running on port 5001."
      );
    }
  }
}

testSubmitDoubt();
