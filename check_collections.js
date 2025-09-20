import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function listCollections() {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("Collections in database:");
    collections.forEach((collection) => {
      console.log("-", collection.name);
    });

    await client.close();
  } catch (error) {
    console.error("Error listing collections:", error);
  }
}

listCollections();
