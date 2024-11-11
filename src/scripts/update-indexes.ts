import { connectToDatabase } from "../lib/mongoose";
import { Material } from "../models/material";

async function updateIndexes() {
  try {
    await connectToDatabase();

    // Drop existing indexes
    await Material.collection.dropIndexes();

    // Create new compound index
    await Material.collection.createIndex(
      { name: 1, projectId: 1 },
      { unique: true }
    );

    console.log("Indexes updated successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error updating indexes:", error);
    process.exit(1);
  }
}

updateIndexes();
