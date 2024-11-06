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
      return NextResponse.json(
        {
          success: false,
          error: "File is required",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { _count: { select: { uploads: true } } },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        status: "Processing",
        projectId: project.id,
      },
    });

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await IFCParserService.processIFCFile(
        buffer,
        upload.id,
        project.id
      );

      if (result.error) {
        console.error("IFC processing error:", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json(result);
    } catch (processingError) {
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

      return NextResponse.json(
        {
          success: false,
          error:
            processingError instanceof Error
              ? processingError.message
              : "Failed to process IFC file",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
