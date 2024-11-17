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
  try {
    // Validate input data first
    if (!data?.elements?.length) {
      console.error("Invalid input data:", data);
      throw new Error("No elements provided");
    }

    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await connectToDatabase();

    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const uploadObjectId = new mongoose.Types.ObjectId(data.uploadId);

    // Store total element count from the original parse
    const totalElementCount = data.elements.length;

    let savedCount = 0;
    let errors = [];

    // Process elements in smaller batches
    const batchSize = 20;
    for (let i = 0; i < data.elements.length; i += batchSize) {
      const batch = data.elements.slice(i, i + batchSize);

      try {
        // Process materials for the entire batch first
        const processedBatch = await Promise.all(
          batch.map(async (element) => ({
            element,
            materials: await processMaterials(element, projectObjectId),
          }))
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
              },
            },
            upsert: true,
          },
        }));

        // Execute bulk operation
        const result = await Element.bulkWrite(operations);
        savedCount += result.upsertedCount + result.modifiedCount;
      } catch (batchError) {
        console.error("Batch processing error:", batchError);
        errors.push({
          batch: i / batchSize,
          error: batchError.message,
        });
      }
    }

    // Update upload status with both counts
    await Upload.findByIdAndUpdate(uploadObjectId, {
      status: "Completed",
      elementCount: totalElementCount,
      materialCount: data.materialCount,
    });

    return {
      success: true,
      elementCount: totalElementCount,
      materialCount: data.materialCount,
    };
  } catch (error) {
    console.error("Fatal error in saveElements:", error);

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

  // Process material layers if available
  if (element.materialLayers?.layers) {
    // Calculate total thickness for volume fraction
    const totalThickness = element.materialLayers.layers.reduce(
      (sum: number, layer: any) => sum + (Number(layer.thickness) || 0),
      0
    );

    for (const layer of element.materialLayers.layers) {
      if (layer.materialName) {
        try {
          const layerThickness = Number(layer.thickness) || 0;
          // Calculate volume fraction based on thickness ratio
          const volumeFraction = totalThickness > 0
            ? layerThickness / totalThickness
            : 1 / element.materialLayers.layers.length;

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
            processedMaterials.push({
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
  // If no layers but direct materials exist, process them
  else if (element.materials && element.materials.length > 0 && !element.materials.includes("No materials found")) {
    const materialCount = element.materials.length;
    const volumePerMaterial = elementVolume / materialCount;

    for (const materialName of element.materials) {
      try {
        const savedMaterial = await Material.findOneAndUpdate(
          {
            name: materialName,
            projectId: projectObjectId,
          },
          {
            $setOnInsert: {
              name: materialName,
              projectId: projectObjectId,
            },
            $set: {
              category: "Direct Assignment",
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
          processedMaterials.push({
            material: savedMaterial._id,
            volume: Math.max(0, volumePerMaterial),
            density: 0,
            mass: 0,
            fraction: 1 / materialCount,
            indicators: {
              gwp: 0,
              ubp: 0,
              penre: 0,
            },
          });
        }
      } catch (materialError) {
        console.error("Direct material processing error:", {
          materialName,
          error: materialError.message,
          projectId: projectObjectId.toString(),
        });
      }
    }
  }

  return processedMaterials;
}
