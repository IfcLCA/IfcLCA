import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const { ecoMaterial } = await request.json();
    const kbobId = ecoMaterial?.id || ecoMaterial;

    // Get the material first to check project ownership
    const material = await Material.findById(params.id)
      .select("projectId")
      .lean();

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this project
    const project = await Project.findOne({
      _id: material.projectId,
      userId
    }).lean();

    if (!project) {
      return NextResponse.json(
        { error: "Not authorized to modify this material" },
        { status: 403 }
      );
    }

    // Update the material with eco material match
    const updatedMaterial = await Material.findByIdAndUpdate(
      params.id,
      {
        $set: {
          kbobMatchId: new mongoose.Types.ObjectId(kbobId),
        },
      },
      { new: true }
    ).populate("kbobMatchId");

    if (!updatedMaterial) {
      return NextResponse.json(
        { error: "Failed to update material" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updatedMaterial._id.toString(),
      name: updatedMaterial.name,
      category: updatedMaterial.category,
      volume: updatedMaterial.volume,
      ecoMaterial: updatedMaterial.kbobMatchId
        ? {
            id: updatedMaterial.kbobMatchId._id.toString(),
            name: updatedMaterial.kbobMatchId.Name,
            indicators: {
              gwp: updatedMaterial.kbobMatchId.GWP,
              ubp: updatedMaterial.kbobMatchId.UBP,
              penre: updatedMaterial.kbobMatchId.PENRE,
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to match material:", error);
    return NextResponse.json(
      { error: "Failed to match material" },
      { status: 500 }
    );
  }
}