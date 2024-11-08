import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element } from "@/models";
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

    // Get uploads and counts
    const [uploads, uploadsCount, elementsCount] = await Promise.all([
      Upload.find({ projectId: project._id }).lean(),
      Upload.countDocuments({ projectId: project._id }),
      Element.countDocuments({ projectId: project._id }),
    ]);

    // Format response
    const formattedProject = {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      phase: project.phase,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      uploads: uploads.map((upload) => ({
        ...upload,
        id: upload._id.toString(),
        projectId: upload.projectId.toString(),
      })),
      _count: {
        uploads: uploadsCount,
        elements: elementsCount,
      },
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
    const { name, description } = await request.json();

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);

    if (
      error instanceof Error &&
      typeof (error as any).code === "string" &&
      (error as any).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

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
    // Delete all related records first
    await prisma.$transaction([
      // Delete all elements associated with uploads in this project
      prisma.element.deleteMany({
        where: {
          upload: {
            projectId: params.id,
          },
        },
      }),
      // Delete all uploads associated with this project
      prisma.upload.deleteMany({
        where: {
          projectId: params.id,
        },
      }),
      // Finally delete the project
      prisma.project.delete({
        where: {
          id: params.id,
        },
      }),
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
