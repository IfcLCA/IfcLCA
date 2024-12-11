import { logger } from "@/lib/logger";
import { Element, Material, Upload } from "@/models";
import mongoose, { ClientSession } from "mongoose";

export class UploadService {
  /**
   * Process materials from an Ifc file upload
   */
  static async processMaterials(
    projectId: string,
    elements: Array<{
      id: string;
      name: string;
      type: string;
      globalId: string;
      netVolume?: number;
      materialLayers?: any;
      properties?: {
        loadBearing?: boolean;
        isExternal?: boolean;
      };
    }>,
    uploadId: string,
    session: ClientSession
  ) {
    try {
      // Create elements
      const processedElements = await Element.create(
        elements.map((element) => ({
          projectId,
          guid: element.globalId,
          name: element.name,
          type: element.type,
          volume: element.netVolume || 0,
          loadBearing: element.properties?.loadBearing || false,
          isExternal: element.properties?.isExternal || false,
          materials: [],
        })),
        { session }
      );
    } catch (error) {
      logger.error("Error in material processing", { error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process elements from an Ifc file upload
   */
  static async processElements(
    projectId: string,
    elements: Array<{
      id: string;
      name: string;
      category: string;
      volume: number;
      materials: Array<{
        name: string;
        thickness: number;
      }>;
    }>,
    uploadId: string
  ) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        logger.info("Starting element processing phase");
        logger.info(`Processing ${elements.length} elements`);
        logger.info("Element categories:", [
          ...new Set(elements.map((e) => e.category)),
        ]);

        // First, get all materials from DB for this project
        const existingMaterials = await Material.find({
          projectId: new mongoose.Types.ObjectId(projectId),
        })
          .select("_id name")
          .lean();

        logger.info(`Found ${existingMaterials.length} materials in database`);

        // Create a map for quick lookups, normalize material names
        const materialMap = new Map(
          existingMaterials.map((m) => [m.name.trim().toLowerCase(), m._id])
        );

        // Process elements in batches to avoid memory issues
        const batchSize = 50;
        const batches = elements.reduce((acc, element, index) => {
          const chunkIndex = Math.floor(index / batchSize);
          if (!acc[chunkIndex]) {
            acc[chunkIndex] = [];
          }
          acc[chunkIndex].push(element);
          return acc;
        }, []);

        let processedElements = 0;
        let elementsWithMissingMaterials = 0;
        let totalMaterialReferences = 0;
        let successfulMaterialReferences = 0;

        logger.info(
          `Processing elements in ${batches.length} batches of ${batchSize}`
        );

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);

          const ops = batch.map((element) => {
            // Map material references
            const materialRefs = element.materials
              .map((material) => {
                totalMaterialReferences++;
                const normalizedName = material.name.trim().toLowerCase();
                const materialId = materialMap.get(normalizedName);

                if (!materialId) {
                  return null;
                }

                successfulMaterialReferences++;
                return {
                  materialId,
                  thickness: material.thickness,
                };
              })
              .filter(
                (ref): ref is { materialId: any; thickness: number } =>
                  ref !== null
              );

            if (materialRefs.length === 0) {
              elementsWithMissingMaterials++;
            }

            return {
              updateOne: {
                filter: {
                  projectId: new mongoose.Types.ObjectId(projectId),
                  elementId: element.id,
                },
                update: {
                  $setOnInsert: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    elementId: element.id,
                    createdAt: new Date(),
                  },
                  $set: {
                    name: element.name,
                    category: element.category,
                    volume: element.volume,
                    materials: materialRefs,
                    updatedAt: new Date(),
                  },
                },
                upsert: true,
              },
            };
          });

          if (ops.length > 0) {
            const result = await Element.bulkWrite(ops, { session });
            processedElements += result.upsertedCount + result.modifiedCount;
          }
        }

        // Update upload status
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            $set: {
              elementCount: processedElements,
              status: "Completed",
            },
          },
          { session }
        );

        const successRate = (
          (successfulMaterialReferences / totalMaterialReferences) *
          100
        ).toFixed(1);
        logger.info("Element processing summary", {
          totalElementsProcessed: processedElements,
          elementsWithMissingMaterials,
          totalMaterialReferences,
          successfulMaterialReferences,
          materialReferenceSuccessRate: `${successRate}%`,
        });

        logger.info("Element processing phase completed");

        return {
          success: true,
          elementCount: processedElements,
        };
      });
    } catch (error) {
      logger.error("Error in element processing", { error });
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
