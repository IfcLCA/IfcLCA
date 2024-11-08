import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

// Update interfaces to be plain object types (for lean queries)
interface IProject {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  phase: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IUpload {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  // other upload fields
  __v: number;
}

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

    const project = (await Project.findById(params.id)
      .lean()
      .exec()) as unknown as IProject;

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get uploads and counts with proper typing
    const [uploads, uploadsCount, elementsCount] = await Promise.all([
      Upload.find({ projectId: project._id })
        .lean()
        .exec() as unknown as IUpload[],
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
