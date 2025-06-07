import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial, OekobaudatMaterial } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { source: string } }
) {
  try {
    await connectToDatabase();

    const source = params.source.toLowerCase();

    if (source === "kbob") {
      const materials = await KBOBMaterial.findValidMaterials();
      return NextResponse.json(materials);
    }

    if (source === "oekobaudat") {
      const materials = await OekobaudatMaterial.findValidMaterials();
      return NextResponse.json(materials);
    }

    return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
