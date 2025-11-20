import { NextResponse } from "next/server";
import { KbobService } from "@/lib/services/kbob-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
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
        error: error.message || "Failed to sync materials",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    logger.info("[KBOB Sync] Starting manual sync (GET)...");
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
        error: error.message || "Failed to sync materials",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

