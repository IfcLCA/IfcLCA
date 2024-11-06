import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { IFCParserService } from "@/lib/services/ifc-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("Upload request received for project:", params.id);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    console.log(
      "Processing file:",
      file.name,
      "size:",
      file.size,
      "for project:",
      params.id
    );

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { _count: { select: { uploads: true } } },
    });

    if (!project) {
      console.error("Project not found:", params.id);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create upload record
    console.log("Creating upload record for project:", project.id);
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        status: "Processing",
        projectId: project.id,
      },
    });

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      console.log("Processing IFC file for upload:", upload.id);

      const result = await IFCParserService.processIFCFile(
        buffer,
        upload.id,
        project.id
      );

      console.log("Processing complete for upload:", upload.id);
      return NextResponse.json({
        ...result,
        uploadId: upload.id,
        projectId: project.id,
      });
    } catch (processingError) {
      console.error(
        "IFC processing error for upload:",
        upload.id,
        processingError
      );

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
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
