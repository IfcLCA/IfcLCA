import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { IFCParserService } from "@/lib/services/ifc-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    console.log("Processing file:", file.name, "size:", file.size);

    // Check if project exists, if not create it
    let project = await prisma.project.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      console.log("Creating new project with ID:", params.id);
      project = await prisma.project.create({
        data: {
          id: params.id,
          name: `Project_${params.id}_${Date.now()}`,
          description: "Automatically created from IFC upload",
        },
      });
    }

    // Create upload record
    console.log("Creating upload record");
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        status: "Processing",
        projectId: project.id,
      },
    });

    try {
      // Process file
      console.log("Converting file to buffer");
      const buffer = Buffer.from(await file.arrayBuffer());

      console.log("Processing IFC file");
      const result = await IFCParserService.processIFCFile(
        buffer,
        upload.id,
        project.id
      );

      console.log("Processing complete");
      return NextResponse.json({
        ...result,
        projectCreated: !project,
        projectId: project.id,
      });
    } catch (processingError) {
      console.error("IFC processing error:", processingError);

      // Update upload status to failed
      await prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: "Failed",
          error:
            processingError instanceof Error
              ? processingError.message
              : "Unknown error",
        },
      });

      throw processingError;
    }
  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process IFC file",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
