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

      cached.promise = mongoose.connect(MONGODB_URI, opts) as any;
    }

    cached.conn = await cached.promise;

    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
}
