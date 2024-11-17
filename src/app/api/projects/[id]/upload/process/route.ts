import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material } from "@/models";
import { MaterialService } from "@/lib/services/material-service";
import { logger } from "@/lib/logger";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const maxDuration = 300;

interface IFCElement {
  materialLayers?: {
    layers?: Array<{
      materialName?: string;
      thickness?: number;
      layerId?: string;
      layerName?: string;
    }>;
    layerSetName?: string;
  };
  globalId: string;
  name: string;
  type: string;
  netVolume?: number;
  spatialContainer?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await mongoose.startSession();
  let uploadId: string | undefined;

  try {
    const body = await request.json();
    uploadId = body.uploadId;
    const { elements, isLastChunk } = body;

    if (!uploadId || !elements) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    await session.withTransaction(async () => {
      // Process materials and elements
      const processResult = await MaterialService.processMaterials(
        params.id,
        elements,
        uploadId!,
        session
      );

      // Update upload status if this is the last chunk
      if (isLastChunk) {
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            status: "Completed",
            elementCount: processResult.elementCount,
            materialCount: processResult.materialCount,
          },
          { session }
        );

        console.log("Processing complete", processResult);
      }

      return processResult;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing chunk:", error);

    if (uploadId) {
      try {
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            status: "Failed",
            error: error.message || "Unknown error occurred",
          },
          { session }
        );
      } catch (updateError) {
        console.error("Failed to update upload status:", updateError);
      }
    }

    return NextResponse.json(
      { error: error.message || "Error processing upload" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
