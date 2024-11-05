import { NextResponse } from "next/server";
import { prisma, type PrismaClient } from "@/lib/db";

export const runtime = "edge";
export const maxDuration = 300; // 5 minutes

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get the file data from the request
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Create the upload record
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        status: "Processing",
        elementCount: 0,
        projectId: params.id,
      },
    });

    // Send file to processing API
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const response = await fetch(process.env.IFC_PROCESSING_API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: base64,
        uploadId: upload.id,
        projectId: params.id,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to process IFC file");
    }

    const { elements } = await response.json();

    // Store elements and materials in database
    await prisma.$transaction(async (tx: PrismaClient) => {
      for (const element of elements) {
        const storedElement = await tx.element.create({
          data: {
            guid: element.guid,
            name: element.name,
            type: element.type,
            volume: element.volume,
            buildingStorey: element.buildingStorey,
            projectId: params.id,
            uploadId: upload.id,
          },
        });

        if (element.materials?.length) {
          await Promise.all(
            element.materials.map((material: any) =>
              tx.material.create({
                data: {
                  name: material.name,
                  volume: material.volume,
                  fraction: material.fraction,
                  elementId: storedElement.id,
                },
              })
            )
          );
        }
      }

      // Update upload status
      await tx.upload.update({
        where: { id: upload.id },
        data: {
          status: "Completed",
          elementCount: elements.length,
        },
      });
    });

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
