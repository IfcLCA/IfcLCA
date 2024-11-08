import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function POST(
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

    const projectId = new mongoose.Types.ObjectId(params.id);
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const upload = await Upload.create({
      filename: file.name,
      status: "Processing",
      elementCount: 0,
      projectId: projectId,
    });

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
