"use server";

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { Element, Material, Upload } from "@/models";
import { z } from "zod";
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

export async function saveElements(
  projectId: string,
  data: { elements: any[]; uploadId: string; materialCount: number }
) {
  console.log('[DEBUG] Starting saveElements:', {
    projectId,
    uploadId: data.uploadId,
    elementCount: data?.elements?.length,
    materialCount: data.materialCount
  });

  try {
    // Validate input data first
    if (!data?.elements?.length) {
      console.error("[DEBUG] Invalid input data:", data);
      throw new Error("No elements provided");
    }

    const { userId } = await auth();
    if (!userId) {
      console.error("[DEBUG] Authentication failed");
      throw new Error("Unauthorized");
    }

    await connectToDatabase();
    console.log("[DEBUG] Database connected");

    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const uploadObjectId = new mongoose.Types.ObjectId(data.uploadId);

    // Store total element count from the original parse
    const totalElementCount = data.elements.length;
    console.log("[DEBUG] Processing elements:", {
      total: totalElementCount,
      firstElement: data.elements[0]
    });

    let savedCount = 0;
    let errors = [];

    // Process elements in smaller batches
    const batchSize = 20;
    for (let i = 0; i < data.elements.length; i += batchSize) {
      const batch = data.elements.slice(i, i + batchSize);
      console.log(`[DEBUG] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.elements.length/batchSize)}`, {
        batchSize: batch.length,
        startIndex: i
      });

      try {
        // Process materials for the entire batch first
        console.log("[DEBUG] Processing materials for batch");
        const processedBatch = await Promise.all(
          batch.map(async (element) => {
            const materials = await processMaterials(element, projectObjectId);
            console.log("[DEBUG] Processed materials for element:", {
              elementId: element.globalId,
              materialCount: materials.length
            });
            return { element, materials };
          })
        );

        // Create operations using processed materials
        const operations = processedBatch.map(({ element, materials }) => ({
          updateOne: {
            filter: {
              guid: element.globalId,
              projectId: projectObjectId,
            },
            update: {
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
                materials,
                updatedAt: new Date()
              },
            },
            upsert: true,
          },
        }));

        // Execute bulk operation
        console.log("[DEBUG] Executing bulk write operation:", {
          operationCount: operations.length
        });
        
        const result = await Element.bulkWrite(operations);
        savedCount += result.upsertedCount + result.modifiedCount;
        
        console.log("[DEBUG] Batch result:", {
          upserted: result.upsertedCount,
          modified: result.modifiedCount,
          total: savedCount
        });
      } catch (batchError) {
        console.error("[DEBUG] Batch processing error:", {
          error: batchError,
          batch: i / batchSize,
          elements: batch.map(e => e.globalId)
        });
        errors.push({
          batch: i / batchSize,
          error: batchError.message,
        });
      }
    }

    // Update upload status with both counts
    console.log("[DEBUG] Updating upload status:", {
      uploadId: uploadObjectId,
      elementCount: totalElementCount,
      materialCount: data.materialCount
    });

    await Upload.findByIdAndUpdate(uploadObjectId, {
      status: "Completed",
      elementCount: totalElementCount,
      materialCount: data.materialCount,
    });

    const result = {
      success: true,
      elementCount: totalElementCount,
      materialCount: data.materialCount,
    };

    console.log("[DEBUG] Save operation completed:", result);
    return result;

  } catch (error) {
    console.error("[DEBUG] Fatal error in saveElements:", {
      error,
      projectId,
      uploadId: data?.uploadId
    });

    if (data?.uploadId) {
      try {
        await Upload.findByIdAndUpdate(data.uploadId, {
          status: "Failed",
          error: error.message,
        });
      } catch (updateError) {
        console.error("[DEBUG] Failed to update upload status:", updateError);
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
  console.log("[DEBUG] Processing materials for element:", {
    elementId: element.globalId,
    type: element.type,
    hasLayers: !!element.materialLayers?.layers
  });

  const processedMaterials = [];
  const elementVolume =
    element.netVolume === "Unknown" ? 0 : Number(element.netVolume) || 0;

  // Process material layers if available
  if (element.materialLayers?.layers) {
    // Calculate total thickness for volume fraction
    const totalThickness = element.materialLayers.layers.reduce(
      (sum: number, layer: any) => sum + (Number(layer.thickness) || 0),
      0
    );

    console.log("[DEBUG] Processing material layers:", {
      layerCount: element.materialLayers.layers.length,
      totalThickness
    });

    for (const layer of element.materialLayers.layers) {
      if (layer.materialName) {
        try {
          const layerThickness = Number(layer.thickness) || 0;
          // Calculate volume fraction based on thickness ratio
          const volumeFraction = totalThickness > 0
            ? layerThickness / totalThickness
            : 1 / element.materialLayers.layers.length;

          console.log("[DEBUG] Processing material layer:", {
            materialName: layer.materialName,
            thickness: layerThickness,
            volumeFraction
          });

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
                category: element.materialLayers?.layerSetName || element.type,
                updatedAt: new Date(),
              },
            },
            {
              upsert: true,
              new: true,
              runValidators: true,
            }
          );

          if (savedMaterial) {
            const materialData = {
              material: savedMaterial._id,
              volume: Math.max(0, elementVolume * volumeFraction),
              density: 0,
              mass: 0,
              fraction: volumeFraction,
              thickness: layerThickness,
              indicators: {
                gwp: 0,
                ubp: 0,
                penre: 0,
              },
            };

            console.log("[DEBUG] Added material to element:", {
              materialId: savedMaterial._id,
              materialName: layer.materialName,
              volume: materialData.volume
            });

            processedMaterials.push(materialData);
          }
        } catch (materialError) {
          console.error("[DEBUG] Material processing error:", {
            material: layer.materialName,
            error: materialError,
            projectId: projectObjectId.toString(),
          });
        }
      }
    }
  }
  
  console.log("[DEBUG] Finished processing materials:", {
    elementId: element.globalId,
    processedCount: processedMaterials.length
  });

  return processedMaterials;
}