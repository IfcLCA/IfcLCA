import { NextResponse } from "next/server";
import { KbobService } from "@/lib/services/kbob-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Manual sync endpoint - restricted to development or authenticated requests
 */
async function handleSync() {
  // Security: Only allow in development or with valid admin secret
  const isDevelopment = process.env.NODE_ENV === "development";
  const syncSecret = process.env.KBOB_SYNC_SECRET;
  
  if (!isDevelopment && !syncSecret) {
    logger.warn("[KBOB Sync] Sync endpoint called but not available in production without KBOB_SYNC_SECRET");
    return NextResponse.json(
      { error: "Sync endpoint not available" },
      { status: 404 }
    );
  }

  try {
    logger.info("[KBOB Sync] Starting manual sync...");
    const result = await KbobService.syncMaterials();
    
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      message: `Synced ${result.synced} materials with ${result.errors} errors`,
    });
  } catch (error: any) {
    logger.error("[KBOB Sync] Sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync materials",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Check authorization header if in production
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.KBOB_SYNC_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn("[KBOB Sync] Unauthorized sync attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }
  
  return handleSync();
}

export async function GET(request: Request) {
  // Check authorization header if in production
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.KBOB_SYNC_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn("[KBOB Sync] Unauthorized sync attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }
  
  return handleSync();
}

