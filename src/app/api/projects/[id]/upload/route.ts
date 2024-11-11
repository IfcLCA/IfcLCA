import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload } from "@/models";
import { auth } from "@clerk/nextjs/server";

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

    const formData = await request.formData();
    const file = formData.get("file");
    console.log("File received:", {
      fileName: file instanceof File ? file.name : "not a file",
      fileType: file instanceof File ? file.type : typeof file,
    });

    if (!file || !(file instanceof File)) {
      console.log("Invalid file provided");
      return NextResponse.json(
        { error: "Invalid file provided" },
        { status: 400 }
      );
    }

    console.log("Connecting to database...");
    await connectToDatabase();

    console.log("Creating upload record...");
    const upload = await Upload.create({
      projectId: params.id,
      userId,
      filename: file.name,
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
      filename: file.name,
    };
    console.log("Sending response:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Upload creation failed:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create upload record",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
