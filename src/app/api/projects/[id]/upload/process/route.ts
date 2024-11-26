import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload } from "@/models";
import { MaterialService } from "@/lib/services/material-service";
import mongoose from "mongoose";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

interface IFCElement {
  materialLayers?: {
    layers?: Array<{
      materialName?: string;
      thickness?: number;
      layerId?: string;
      layerName?: string;
      volume?: number;
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

  try {
    const { uploadId, elements, isLastChunk } = await request.json();
    
    if (!uploadId || !elements || typeof isLastChunk !== 'boolean') {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    await session.withTransaction(async () => {
      // Process materials and elements
      await MaterialService.processMaterials(
        params.id,
        elements,
        uploadId,
        session
      );

      if (isLastChunk) {
        // Update upload status when processing is complete
        await Upload.findByIdAndUpdate(
          uploadId,
          { status: 'completed' },
          { session }
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Process Materials API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
