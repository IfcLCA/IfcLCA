import { NextResponse } from "next/server";
import { connectToDatabase, formatDocuments } from "@/lib/mongodb";
import { Material } from "@/models";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    let query = {};
    if (projectId) {
      query = {
        projects: new mongoose.Types.ObjectId(projectId),
      };
    }

    const materials = await Material.find(query)
      .populate({
        path: "projects",
        select: "volume",
      })
      .lean();

    const processedMaterials = materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume:
        material.projects?.reduce(
          (sum: number, proj: any) => sum + (proj.volume || 0),
          0
        ) || 0,
    }));

    return NextResponse.json(processedMaterials);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
