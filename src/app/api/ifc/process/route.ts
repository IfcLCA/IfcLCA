import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";

export const maxDuration = 300; // 5 minutes
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward to external API with server-side API key
    const externalFormData = new FormData();
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
    externalFormData.append("file", fileBlob, file.name || "upload.ifc");

    const response = await fetch(
      "https://openbim-service-production.up.railway.app/api/ifc/process",
      {
        method: "POST",
        headers: {
          "X-API-Key": process.env.IFC_API_KEY!, // Server-side env variable
        },
        body: externalFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("External API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error("Failed to process Ifc file");
    }

    // Stream the response back to the client
    const stream = response.body;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
      },
    });
  } catch (error) {
    logger.error("Error in Ifc processing:", error);
    return NextResponse.json(
      { error: "Failed to process Ifc file" },
      { status: 500 }
    );
  }
}
