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
    console.log("Upload request received:", { projectId: params.id });

    const { userId } = await auth();
    console.log("Auth check:", { userId });

    if (!userId) {
      console.log("Unauthorized request - no userId");
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const filename = body.filename || "Unnamed File";

    console.log("Creating upload record...");
    await connectToDatabase();

    const upload = await Upload.create({
      projectId: params.id,
      userId,
      filename,
      status: "Processing",
      elementCount: 0,
    });

    console.log("Upload record created:", {
      uploadId: upload._id.toString(),
      filename: upload.filename,
    });

    const response = {
      success: true,
      uploadId: upload._id.toString(),
      status: "Processing",
      filename,
    };

    console.log("Sending response:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Upload creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create upload record" },
      { status: 500 }
    );
  }
}
