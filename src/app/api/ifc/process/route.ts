import { NextResponse } from "next/server";
import { IFCParserService } from "@/lib/services/ifc-parser";
import { readFile, unlink } from "fs/promises";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { filePath, uploadId, projectId } = await request.json();

    // Read the file
    const buffer = await readFile(filePath);

    // Process the file
    const result = await IFCParserService.processIFCFile(
      buffer,
      uploadId,
      projectId
    );

    // Clean up the temporary file
    await unlink(filePath).catch(console.error);

    return NextResponse.json(result);
  } catch (error) {
    console.error("IFC processing error:", error);
    return NextResponse.json(
      { error: "Failed to process IFC file" },
      { status: 500 }
    );
  }
}
