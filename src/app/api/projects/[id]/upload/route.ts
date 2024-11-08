import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const projectId = new mongoose.Types.ObjectId(params.id);

    // Check if project exists using MongoDB
    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Create upload record using MongoDB
    const upload = await Upload.create({
      filename: file.name,
      status: "Processing",
      elementCount: 0,
      projectId: projectId,
    });

    // Process the file upload...
    // Your existing IFC processing logic here

    return NextResponse.json({
      id: upload._id.toString(),
      filename: upload.filename,
      status: upload.status,
      projectId: upload.projectId.toString(),
      createdAt: upload.createdAt,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
