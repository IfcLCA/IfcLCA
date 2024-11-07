import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { IFCParser } from "@/lib/services/ifc-parser-new";

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
      const content = buffer.toString("utf-8");
      const parser = new IFCParser();
      const elements = parser.parseContent(content);

      // Use upsert to handle duplicates
      for (const element of elements) {
        await prisma.element.upsert({
          where: { guid: element.globalId },
          update: {
            name: element.name,
            type: element.type,
            volume: element.netVolume,
            buildingStorey: element.spatialContainer,
            projectId: project.id,
            uploadId: upload.id,
          },
          create: {
            guid: element.globalId,
            name: element.name,
            type: element.type,
            volume: element.netVolume,
            buildingStorey: element.spatialContainer,
            projectId: project.id,
            uploadId: upload.id,
          },
        });
      }

      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: "Completed", elementCount: elements.length },
      });

      return NextResponse.json({ success: true, elements });
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
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
