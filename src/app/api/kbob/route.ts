import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial } from "@/models/kbob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    const materials = await KBOBMaterial.findValidMaterials();
    console.log(`KBOB Materials fetched: ${materials.length}`);

    return NextResponse.json(materials);
  } catch (error) {
    console.error("Error fetching KBOB materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch KBOB materials" },
      { status: 500 }
    );
  }
}
