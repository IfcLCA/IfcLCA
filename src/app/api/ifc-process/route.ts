import { NextResponse } from "next/server";

// This endpoint should NOT use edge runtime
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { file, uploadId, projectId } = await request.json();

    // Process the base64 file data
    const buffer = Buffer.from(file, "base64");

    // Call Python script using spawn
    const elements: any[] = [];
    // ... your existing Python processing code ...

    return NextResponse.json({ elements });
  } catch (error) {
    console.error("IFC processing error:", error);
    return NextResponse.json(
      { error: "Failed to process IFC file" },
      { status: 500 }
    );
  }
}
