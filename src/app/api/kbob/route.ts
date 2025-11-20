import { NextResponse } from "next/server";
import { KbobService } from "@/lib/services/kbob-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    
    const materials = await KbobService.getMaterials(forceRefresh);
    
    return NextResponse.json(materials);
  } catch (error) {
    logger.error("Error fetching KBOB materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch KBOB materials" },
      { status: 500 }
    );
  }
}
