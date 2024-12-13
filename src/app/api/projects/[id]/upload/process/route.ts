import { logger } from "@/lib/logger";
import { connectToDatabase } from "@/lib/mongodb";
import { IFCProcessingService } from "@/lib/services/ifc-processing-service";
import { Upload } from "@/models";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

interface IFCMaterial {
  name: string;
  volume: number;
}

interface IFCElement {
  globalId: string;
  type: string;
  name: string;
  volume: number;
  properties: {
    loadBearing?: boolean;
    isExternal?: boolean;
  };
  materials: IFCMaterial[];
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await mongoose.startSession();

  try {
    const { uploadId, elements } = (await request.json()) as {
      uploadId: string;
      elements: IFCElement[];
    };

    await connectToDatabase();

    await session.withTransaction(async () => {
      // Process elements and find automatic matches
      const uniqueMaterialNames = [
        ...new Set(
          elements.flatMap(
            (e: IFCElement) =>
              e.materials?.map((m: IFCMaterial) => m.name) || []
          )
        ),
      ];

      // Run both operations in parallel
      const [elementResult, matchResult] = await Promise.all([
        IFCProcessingService.processElements(
          params.id,
          elements,
          uploadId,
          session
        ),
        IFCProcessingService.findAutomaticMatches(
          params.id,
          uniqueMaterialNames,
          session
        ),
      ]);

      // Update upload status
      await Upload.findByIdAndUpdate(
        uploadId,
        {
          status: "completed",
          elementCount: elementResult.elementCount,
          materialCount: elementResult.materialCount,
          matchedMaterialCount: matchResult.matchedCount,
        },
        { session }
      );
    });

    return NextResponse.json({
      success: true,
      shouldRedirectToLibrary: true,
    });
  } catch (error) {
    logger.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
