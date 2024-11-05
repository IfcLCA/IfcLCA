import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IfcProcessingService } from "@/services/ifcProcessingService";
import path from "path";
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";

const ifcProcessor = new IfcProcessingService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Create upload record
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        status: "Processing",
        projectId: params.id,
      },
    });

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads/temp");
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, `${upload.id}.ifc`);
    await writeFile(filePath, buffer);

    // Process IFC file asynchronously
    ifcProcessor
      .processIfc(filePath, upload.id, params.id)
      .catch(async (error) => {
        console.error("Processing error:", error);
        await prisma.upload.update({
          where: { id: upload.id },
          data: { status: "Failed", error: error.message },
        });
      });

    return NextResponse.json(upload);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
