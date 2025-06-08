import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await connectToDatabase();

    const uploads = await Upload.find({
      projectId: params.id,
      userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = uploads.map((u) => ({
      id: u._id.toString(),
      filename: u.filename,
      status: u.status,
      elementCount: u.elementCount,
      materialCount: u.materialCount,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch uploads:", error);
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
  }
}
