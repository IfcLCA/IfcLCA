import { NextResponse } from "next/server";
import { disconnectDatabase, connectToDatabase } from "@/lib/mongodb";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    logger.info("[KBOB Reset] Resetting database connection...");
    
    // Disconnect and clear cache
    await disconnectDatabase();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to reconnect
    try {
      await connectToDatabase();
      return NextResponse.json({
        success: true,
        message: "Connection reset and reconnected successfully",
      });
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        message: "Connection reset but reconnection failed",
        error: error.message,
      }, { status: 500 });
    }
  } catch (error: any) {
    logger.error("[KBOB Reset] Reset failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset connection",
      },
      { status: 500 }
    );
  }
}

