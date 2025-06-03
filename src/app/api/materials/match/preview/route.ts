import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { MaterialService } from "@/lib/services/material-service";

export async function POST(request: Request) {
  try {
    const { materialIds, kbobMaterialId } = await request.json();
    await connectToDatabase();

    const preview = await MaterialService.getKBOBMatchPreview(
      materialIds,
      kbobMaterialId
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error getting material match preview:", error);
    return NextResponse.json(
      { error: "Failed to get material match preview" },
      { status: 500 }
    );
  }
}
