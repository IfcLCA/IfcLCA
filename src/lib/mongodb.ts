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
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 10000,
      connectTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    console.error("MongoDB connection error:", e);
    // Clear both connection and promise on error to force retry
    cached.promise = null;
    cached.conn = null;
    throw e;
  }
}

/**
 * Force disconnect and clear connection cache
 * Useful when IP whitelist changes or connection needs refresh
 */
export async function disconnectDatabase() {
  try {
    if (cached.conn) {
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error("Error disconnecting:", error);
  } finally {
    cached.conn = null;
    cached.promise = null;
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
