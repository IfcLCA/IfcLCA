import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface MaterialDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  volume?: number;
  projects?: Array<{
    volume?: number;
  }>;
}

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

    const materials = (await Material.find(query)
      .populate({
        path: "projects",
        select: "volume",
      })
      .lean()) as MaterialDoc[];

    const processedMaterials = materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume: material.volume,
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
