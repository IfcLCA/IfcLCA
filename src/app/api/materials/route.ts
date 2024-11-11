import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";

export async function GET() {
  try {
    await connectToDatabase();

    // Simple find query with basic population
    const materials = await Material.find({})
      .select("name category volume kbobMatchId")
      .lean();

    // Transform the data to match the expected format
    const transformedMaterials = materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume: material.volume,
      kbobMatchId: material.kbobMatchId?.toString(),
    }));

    console.log(
      "API Response materials:",
      transformedMaterials.length,
      transformedMaterials[0]
    ); // Debug log

    return NextResponse.json(transformedMaterials);
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
