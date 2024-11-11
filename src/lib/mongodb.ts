import mongoose from "mongoose";

declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.mongoose) {
  global.mongoose = {
    conn: null,
    promise: null,
  };
}

if (!process.env.MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

const MONGODB_URI = process.env.MONGODB_URI;
let cached = global.mongoose;

export async function connectToDatabase() {
  if (cached.conn) {
    console.log("Using cached MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log("Connecting to MongoDB...");
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
    console.log("Successfully connected to MongoDB");
    return cached.conn;
  } catch (e) {
    console.error("MongoDB connection error:", e);
    cached.promise = null;
    throw e;
  }
}

// Helper function to ensure database connection
export async function withDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await connectToDatabase();
    return await operation();
  } catch (error) {
    console.error("Database operation failed:", error);
    throw error;
  }
}

// Helper function to format MongoDB documents
export function formatDocument(doc: any) {
  const formatted = doc.toObject ? doc.toObject() : doc;
  return {
    ...formatted,
    id: formatted._id.toString(),
    _id: undefined,
  };
}

// Helper function to format multiple documents
export function formatDocuments(docs: any[]) {
  return docs.map(formatDocument);
}
