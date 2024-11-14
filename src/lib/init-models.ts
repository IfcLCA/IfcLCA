import { Element, Material } from "@/models";
import mongoose from "mongoose";

export async function initializeIndexes() {
  try {
    // Initialize models
    await Promise.all([Element.init(), Material.init()]);

    // Verify indexes
    const db = mongoose.connection.db;

    // Drop and recreate Element indexes
    await db.collection("elements").dropIndexes();
    await db
      .collection("elements")
      .createIndex(
        { guid: 1, projectId: 1 },
        { unique: true, background: true }
      );

    // Drop and recreate Material indexes
    await db.collection("materials").dropIndexes();
    await db
      .collection("materials")
      .createIndex(
        { name: 1, projectId: 1 },
        { unique: true, background: true }
      );
  } catch (error) {
    console.error("Failed to initialize indexes:", error);
    throw error;
  }
}
