import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload, Element, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const upload = await Upload.findById(params.id).populate("elements");

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    return NextResponse.json(upload);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch upload status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const uploadId = new mongoose.Types.ObjectId(params.id);

  const upload = await Upload.findById(uploadId);
  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const project = await Project.findOne({ _id: upload.projectId, userId });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Element.deleteMany({ uploadId }).session(session);
      await Upload.deleteOne({ _id: uploadId }).session(session);
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
