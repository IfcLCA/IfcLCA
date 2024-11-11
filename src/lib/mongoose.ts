import mongoose from "mongoose";

mongoose.set("debug", true);

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  try {
    if (cached.conn) {
      return cached.conn;
    }

    if (!cached.promise) {
      const opts = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      };

      console.log("Connecting to MongoDB...", MONGODB_URI.split("@")[1]);
      cached.promise = mongoose.connect(MONGODB_URI, opts);
    }

    cached.conn = await cached.promise;
    console.log("Connected to MongoDB");

    return cached.conn;
  } catch (e) {
    console.error("MongoDB connection error:", e);
    cached.promise = null;
    throw e;
  }
}
