import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";

export async function GET() {
  try {
    await connectToDatabase();

    const materials = await Material.find({})
      .select("name category volume kbobMatchId")
      .populate("kbobMatchId")
      .lean();

    const transformedMaterials = materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume: material.volume,
      kbobMatchId: material.kbobMatchId?._id.toString(),
      kbobMatch: material.kbobMatchId
        ? {
            id: material.kbobMatchId._id.toString(),
            Name: material.kbobMatchId.Name,
            GWP: material.kbobMatchId.GWP,
            UBP: material.kbobMatchId.UBP,
            PENRE: material.kbobMatchId.PENRE,
          }
        : undefined,
    }));

    return NextResponse.json(transformedMaterials);
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
