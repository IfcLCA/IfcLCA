import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload } from "@/models";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const filename = body.filename || "Unnamed File";

    await connectToDatabase();

    const upload = await Upload.create({
      projectId: params.id,
      userId,
      filename,
      status: "Processing",
      elementCount: 0,
    });

    const response = {
      success: true,
      uploadId: upload._id.toString(),
      status: "Processing",
      filename,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Upload creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create upload record" },
      { status: 500 }
    );
  }
}
