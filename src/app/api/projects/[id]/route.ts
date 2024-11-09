import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const project = await Project.findById(params.id).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // First fetch elements
    const elements = await Element.find({ projectId: project._id })
      .populate("materials")
      .lean();

    // Then fetch materials and uploads using the elements data
    const [uploads, materials] = await Promise.all([
      Upload.find({
        projectId: project._id,
        deleted: { $ne: true },
      })
        .select("filename status elementCount createdAt")
        .lean(),
      Material.find({
        _id: {
          $in: elements.flatMap((e) => e.materials?.map((m) => m._id) || []),
        },
      }).lean(),
    ]);

    console.log("Found uploads:", uploads.length);
    console.log("Sample upload:", uploads[0]);
    console.log("Found materials:", materials.length);
    console.log("Sample material with volume:", materials[0]);

    // Get counts
    const counts = {
      uploads: uploads.length,
      elements: elements.length,
      materials: materials.length,
    };

    // Format response
    const formattedProject = {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      phase: project.phase,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      uploads: uploads.map((upload) => ({
        id: upload._id.toString(),
        filename: upload.filename,
        status: upload.status || "Unknown",
        elementCount: upload.elementCount || 0,
        createdAt: upload.createdAt,
      })),
      elements: elements.map((element) => ({
        id: element._id.toString(),
        guid: element.guid,
        name: element.name,
        type: element.type,
        volume: element.volume,
        buildingStorey: element.buildingStorey,
        materials:
          element.materials?.map((m: any) => ({
            id: m._id.toString(),
            name: m.name,
            category: m.category,
            volume: m.volume,
          })) || [],
      })),
      materials: materials.map((material) => {
        // Calculate total volume for this material across all elements
        const totalVolume = elements.reduce((sum, element) => {
          const materialInElement = element.materials?.find(
            (m: any) => m._id.toString() === material._id.toString()
          );
          return sum + (materialInElement?.volume || 0);
        }, 0);

        return {
          id: material._id.toString(),
          name: material.name,
          category: material.category,
          volume: totalVolume,
          fraction:
            totalVolume > 0
              ? totalVolume /
                elements.reduce((sum, e) => sum + (e.volume || 0), 0)
              : 0,
        };
      }),
      _count: counts,
    };

    return NextResponse.json(formattedProject);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { name, description } = await request.json();

    const project = await Project.findByIdAndUpdate(
      params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    await Promise.all([
      Element.deleteMany({ projectId: params.id }),
      Upload.deleteMany({ projectId: params.id }),
      Project.findByIdAndDelete(params.id),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
