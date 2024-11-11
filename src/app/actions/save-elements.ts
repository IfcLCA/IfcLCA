"use server";

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { Element, Material, MaterialUsage, Upload } from "@/models";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../../lib/mongoose";

// Validation schemas
const materialLayerSchema = z.object({
  materialName: z.string().optional(),
  thickness: z.number().optional(),
  layerId: z.string().optional(),
  layerName: z.string().optional(),
});

const elementSchema = z.object({
  globalId: z.string(),
  name: z.string(),
  type: z.string(),
  netVolume: z.number().optional(),
  spatialContainer: z.string().optional(),
  materialLayers: z
    .object({
      layerSetName: z.string().optional(),
      layers: z.array(materialLayerSchema).optional(),
    })
    .optional(),
});

const inputSchema = z.object({
  elements: z.array(elementSchema),
  uploadId: z.string(),
});

const BATCH_SIZE = 25; // Smaller batch size for serverless

async function withRetry(fn: () => Promise<any>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.name === "MongooseServerSelectionError" && i < retries - 1) {
        console.log(`Retrying operation, attempt ${i + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        await connectToDatabase(); // Reconnect
        continue;
      }
      throw error;
    }
  }
}

export async function saveElements(
  projectId: string,
  data: { elements: any[]; uploadId: string }
) {
  try {
    // Validate input data first
    if (!data?.elements?.length) {
      console.error("Invalid input data:", data);
      throw new Error("No elements provided");
    }

    // Log the first element for debugging
    console.log(
      "First element sample:",
      JSON.stringify(data.elements[0], null, 2)
    );

    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await connectToDatabase();

    // Validate project and upload IDs
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const uploadObjectId = new mongoose.Types.ObjectId(data.uploadId);

    // Process in smaller batches with error tracking
    const batchSize = 25;
    let savedCount = 0;
    let errors = [];

    for (let i = 0; i < data.elements.length; i += batchSize) {
      const batch = data.elements.slice(i, i + batchSize);

      try {
        await Promise.all(
          batch.map(async (element) => {
            try {
              // Validate element data
              if (!element.globalId || !element.name) {
                throw new Error(
                  `Invalid element data: ${JSON.stringify(element)}`
                );
              }

              // Process materials
              const processedMaterials = await processMaterials(
                element,
                projectObjectId
              );

              // Save element
              const result = await Element.findOneAndUpdate(
                {
                  guid: element.globalId,
                  projectId: projectObjectId,
                },
                {
                  $set: {
                    projectId: projectObjectId,
                    uploadId: uploadObjectId,
                    guid: element.globalId,
                    name: element.name,
                    type: element.type,
                    volume:
                      element.netVolume === "Unknown"
                        ? 0
                        : Number(element.netVolume) || 0,
                    buildingStorey: element.spatialContainer,
                    materials: processedMaterials,
                  },
                },
                {
                  upsert: true,
                  new: true,
                  runValidators: true,
                }
              );

              if (result) savedCount++;
            } catch (elementError) {
              errors.push({
                element: element.globalId,
                error: elementError.message,
              });
              console.error("Element processing error:", {
                guid: element.globalId,
                error: elementError.message,
              });
            }
          })
        );
      } catch (batchError) {
        console.error("Batch processing error:", batchError);
        errors.push({
          batch: i / batchSize,
          error: batchError.message,
        });
      }
    }

    // Update upload status with error information
    await Upload.findByIdAndUpdate(uploadObjectId, {
      status: errors.length > 0 ? "Completed with errors" : "Completed",
      elementCount: savedCount,
      errors: errors.length > 0 ? errors : undefined,
    });

    // Return detailed response
    return {
      success: true,
      savedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${savedCount} elements${
        errors.length > 0 ? ` with ${errors.length} errors` : ""
      }`,
    };
  } catch (error) {
    console.error("Fatal error in saveElements:", {
      error: error.message,
      stack: error.stack,
    });

    // Update upload status on fatal error
    if (data?.uploadId) {
      try {
        await Upload.findByIdAndUpdate(data.uploadId, {
          status: "Failed",
          error: error.message,
        });
      } catch (updateError) {
        console.error("Failed to update upload status:", updateError);
      }
    }

    throw error;
  }
}

// Helper function to process materials
async function processMaterials(
  element: any,
  projectObjectId: mongoose.Types.ObjectId
) {
  const processedMaterials = [];
  const elementVolume =
    element.netVolume === "Unknown" ? 0 : Number(element.netVolume) || 0;

  if (element.materialLayers?.layers) {
    for (const layer of element.materialLayers.layers) {
      if (layer.materialName) {
        try {
          const layerThickness = Number(layer.thickness) || 0;
          const volume = elementVolume * layerThickness;

          // Use a single atomic operation with upsert
          const savedMaterial = await Material.findOneAndUpdate(
            {
              name: layer.materialName,
              projectId: projectObjectId,
            },
            {
              $setOnInsert: {
                name: layer.materialName,
                projectId: projectObjectId,
              },
              $set: {
                category: element.materialLayers?.layerSetName,
                volume: Math.max(0, volume),
              },
            },
            {
              upsert: true,
              new: true,
              runValidators: true,
            }
          );

          if (savedMaterial) {
            processedMaterials.push({
              material: savedMaterial._id,
              volume: Math.max(0, volume),
              fraction: elementVolume > 0 ? volume / elementVolume : 0,
            });
          }
        } catch (materialError) {
          console.error("Material processing error:", {
            material: layer.materialName,
            error: materialError.message,
            projectId: projectObjectId.toString(),
          });
        }
      }
    }
  }

  return processedMaterials;
}
