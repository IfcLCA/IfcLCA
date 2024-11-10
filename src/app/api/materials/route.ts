import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    let query = {};
    if (projectId) {
      const project = await Project.findOne({
        _id: projectId,
        userId,
      });

      if (!project) {
        return new Response("Project not found", { status: 404 });
      }

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
      volume: material.volume,
    }));

    return NextResponse.json(processedMaterials);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
