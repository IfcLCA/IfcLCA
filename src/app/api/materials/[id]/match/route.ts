import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;
    const { kbobId } = await request.json();

    // Get the material first to check project ownership
    const material = await Material.findById(id)
      .select("projectId")
      .lean() as { projectId?: mongoose.Types.ObjectId } | null;

    if (!material || !material.projectId) {
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

    // Update the material with KBOB match
    const updatedMaterial = await Material.findByIdAndUpdate(
      id,
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

    // When populated, kbobMatchId contains the KBOB material object
    const kbobMatch = updatedMaterial.kbobMatchId as any;

    return NextResponse.json({
      id: updatedMaterial._id.toString(),
      name: updatedMaterial.name,
      category: updatedMaterial.category,
      volume: updatedMaterial.volume,
      kbobMatch: kbobMatch
        ? {
          id: kbobMatch._id.toString(),
          name: kbobMatch.Name,
          indicators: {
            gwp: getGWP(kbobMatch),
            ubp: getUBP(kbobMatch),
            penre: getPENRE(kbobMatch),
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