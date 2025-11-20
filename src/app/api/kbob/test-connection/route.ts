import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: any = {
    tests: [],
    connectionString: process.env.MONGODB_URI ? "Set (hidden)" : "Not set",
  };

  // Test 1: Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    results.tests.push({
      name: "Environment Variable",
      status: "error",
      message: "MONGODB_URI not set",
    });
    return NextResponse.json(results, { status: 500 });
  }

  results.tests.push({
    name: "Environment Variable",
    status: "ok",
    message: "MONGODB_URI is set",
  });

  // Test 2: Parse connection string
  try {
    const uri = process.env.MONGODB_URI;
    const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)/);
    if (match) {
      results.tests.push({
        name: "Connection String Format",
        status: "ok",
        message: `Host: ${match[3]}, Database: ${match[4].split("?")[0]}`,
      });
    } else {
      results.tests.push({
        name: "Connection String Format",
        status: "error",
        message: "Invalid connection string format",
      });
    }
  } catch (error: any) {
    results.tests.push({
      name: "Connection String Format",
      status: "error",
      message: error.message,
    });
  }

  // Test 3: Try direct connection with detailed error
  try {
    // Disconnect any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const opts = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    };

    await mongoose.connect(process.env.MONGODB_URI!, opts);
    
    results.tests.push({
      name: "Direct Connection",
      status: "ok",
      message: `Connected to ${mongoose.connection.host}`,
    });

    await mongoose.disconnect();
  } catch (error: any) {
    let errorMessage = error.message || "Unknown error";
    
    // Extract more details from error
    if (error.name === "MongooseServerSelectionError") {
      errorMessage = `Server selection failed: ${error.message}`;
      if (error.reason) {
        errorMessage += ` | Reason: ${error.reason.message || error.reason}`;
      }
    }

    results.tests.push({
      name: "Direct Connection",
      status: "error",
      message: errorMessage,
      errorName: error.name,
      errorCode: error.code,
    });
  }

  const hasErrors = results.tests.some((t: any) => t.status === "error");
  return NextResponse.json(results, { status: hasErrors ? 500 : 200 });
}

