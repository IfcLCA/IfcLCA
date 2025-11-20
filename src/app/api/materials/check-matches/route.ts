import { NextResponse } from "next/server";
import { MaterialService } from "@/lib/services/material-service";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { materialNames, projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Verify that the project belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId }).lean();
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!Array.isArray(materialNames)) {
      return NextResponse.json(
        { error: "materialNames must be an array" },
        { status: 400 }
      );
    }

    const unmatchedMaterials = [];
    const matchedMaterials = [];

    for (const materialName of materialNames) {
      const existingMatch = await MaterialService.findExistingMaterial(
        materialName,
        userId
      );
      if (!existingMatch || !existingMatch.kbobMatchId) {
        unmatchedMaterials.push(materialName);
      } else {
        // Extract the ID from the populated object (kbobMatchId is populated, so it's an object with _id)
        // If it's already an ObjectId or string, use it directly
        const kbobMatchIdSource =
          (existingMatch.kbobMatchId as any)?._id ?? existingMatch.kbobMatchId;

        if (!kbobMatchIdSource) {
          unmatchedMaterials.push(materialName);
          continue;
        }

        // Ensure we have a valid ObjectId
        const kbobMatchId = kbobMatchIdSource instanceof mongoose.Types.ObjectId
          ? kbobMatchIdSource
          : new mongoose.Types.ObjectId(kbobMatchIdSource);

        // Create a new material in the current project with the same match
        const newMaterial = await MaterialService.createMaterialWithMatch(
          projectId,
          materialName,
          kbobMatchId,
          existingMatch.density
        );
        matchedMaterials.push(newMaterial);
      }
    }

    return NextResponse.json({
      unmatchedMaterials,
      matchedMaterials,
      unmatchedCount: unmatchedMaterials.length
    });
  } catch (error) {
    console.error("[Material Check API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
