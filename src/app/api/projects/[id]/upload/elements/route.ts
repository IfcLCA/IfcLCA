"use server";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Element, Upload } from "@/models";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Validation schema
const elementSchema = z.object({
  globalId: z.string(),
  name: z.string(),
  type: z.string(),
  netVolume: z.number().optional(),
  spatialContainer: z.string().optional(),
});

const inputSchema = z.object({
  elements: z.array(elementSchema),
  uploadId: z.string(),
});

export async function saveElements(
  projectId: string,
  data: { elements: any[]; uploadId: string }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate input
    const validatedData = inputSchema.parse(data);

    await connectToDatabase();

    // Process elements in batches
    const batchSize = 100;
    let savedCount = 0;

    for (let i = 0; i < validatedData.elements.length; i += batchSize) {
      const batch = validatedData.elements.slice(i, i + batchSize);

      const elementPromises = batch.map(async (element) => {
        try {
          const elementData = {
            projectId,
            uploadId: validatedData.uploadId,
            guid: element.globalId,
            name: element.name,
            type: element.type,
            volume: element.netVolume,
            buildingStorey: element.spatialContainer,
          };

          const savedElement = await Element.create(elementData);
          savedCount++;
          return savedElement;
        } catch (error) {
          logger.error('Failed to save element', { error });
          return null;
        }
      });

      await Promise.all(elementPromises);
    }

    // Update upload status
    await Upload.findByIdAndUpdate(
      validatedData.uploadId,
      {
        status: "Completed",
        elementCount: savedCount,
      },
      { new: true }
    );

    return {
      success: true,
      elementCount: savedCount,
    };
  } catch (error) {
    logger.error('Failed to save elements', { error });
    throw error;
  }
}
