import { NextResponse } from "next/server";
import { MaterialService } from "@/lib/services/material-service";

export async function POST(request: Request) {
  try {
    const { materialNames } = await request.json();
    
    if (!Array.isArray(materialNames)) {
      return NextResponse.json({ error: "materialNames must be an array" }, { status: 400 });
    }

    const unmatchedMaterials = [];
    for (const materialName of materialNames) {
      const existingMatch = await MaterialService.findExistingMaterial(materialName);
      if (!existingMatch) {
        unmatchedMaterials.push(materialName);
      }
    }

    return NextResponse.json({ 
      unmatchedMaterials,
      unmatchedCount: unmatchedMaterials.length 
    });
  } catch (error) {
    console.error("[Material Check API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
