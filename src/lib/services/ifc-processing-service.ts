import { logger } from "@/lib/logger";
import { Element, Material } from "@/models";
import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { MaterialService } from "./material-service";

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
  materials?: IFCMaterial[];
  materialLayers?: {
    layers: Array<{
      materialName: string;
      volume: number;
    }>;
  };
}

export class IFCProcessingService {
  /**
   * Process elements from Ifc file with existing material matches
   */
  static async processElements(
    projectId: string,
    elements: IFCElement[],
    uploadId: string,
    session: ClientSession
  ) {
    try {
      if (!elements?.length) {
        throw new Error("No elements provided for processing");
      }

      logger.debug("Starting Ifc element processing", {
        elementCount: elements.length,
        projectId,
        uploadId,
      });

      // First, process all materials
      const uniqueMaterialNames = new Set(
        elements.flatMap((element) => {
          const directMaterials = element.materials?.map((m) => m.name) || [];
          const layerMaterials =
            element.materialLayers?.layers.map((l) => l.materialName) || [];
          return [...directMaterials, ...layerMaterials];
        })
      );

      logger.debug("Unique materials found", {
        count: uniqueMaterialNames.size,
        materials: Array.from(uniqueMaterialNames),
      });

      // Create materials first
      const materialOps = Array.from(uniqueMaterialNames).map((name) => ({
        updateOne: {
          filter: {
            name,
            projectId: new mongoose.Types.ObjectId(projectId),
          },
          update: {
            $setOnInsert: {
              name,
              projectId: new mongoose.Types.ObjectId(projectId),
              createdAt: new Date(),
            },
            $set: {
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const materialResult = await Material.bulkWrite(materialOps, { session });

      logger.debug("Material creation result", {
        upsertedCount: materialResult.upsertedCount,
        modifiedCount: materialResult.modifiedCount,
        matchedCount: materialResult.matchedCount,
      });

      // Get all materials with their matches
      const materials = await Material.find({
        name: { $in: Array.from(uniqueMaterialNames) },
        projectId: new mongoose.Types.ObjectId(projectId),
      })
        .populate<{ kbobMatchId: IKBOBMaterial }>("kbobMatchId")
        .session(session)
        .lean();

      // Create map for quick lookups
      const materialMatchMap = new Map(materials.map((mat) => [mat.name, mat]));

      // Process elements in batches
      const BATCH_SIZE = 50;
      let processedCount = 0;

      for (let i = 0; i < elements.length; i += BATCH_SIZE) {
        const batch = elements.slice(i, i + BATCH_SIZE);

        const bulkOps = batch.map((element) => {
          const processedMaterials = [];

          // Process direct materials
          if (element.materials?.length) {
            processedMaterials.push(
              ...element.materials
                .map((material) => {
                  const match = materialMatchMap.get(material.name);
                  if (!match) {
                    logger.warn(`Material not found: ${material.name}`);
                    return null;
                  }
                  return {
                    material: match._id,
                    name: material.name,
                    volume: material.volume,
                    indicators: match.kbobMatchId
                      ? MaterialService.calculateIndicators(
                          material.volume,
                          match.density,
                          match.kbobMatchId
                        )
                      : undefined,
                  };
                })
                .filter(Boolean)
            );
          }

          // Process material layers
          if (element.materialLayers?.layers?.length) {
            const totalVolume = element.volume || 0;
            const layers = element.materialLayers.layers;

            processedMaterials.push(
              ...layers
                .map((layer) => {
                  const match = materialMatchMap.get(layer.materialName);
                  if (!match) {
                    logger.warn(`Material not found: ${layer.materialName}`);
                    return null;
                  }
                  return {
                    material: match._id,
                    name: layer.materialName,
                    volume: layer.volume || totalVolume / layers.length,
                    indicators: match.kbobMatchId
                      ? MaterialService.calculateIndicators(
                          layer.volume || totalVolume / layers.length,
                          match.density,
                          match.kbobMatchId
                        )
                      : undefined,
                  };
                })
                .filter(Boolean)
            );
          }

          return {
            updateOne: {
              filter: {
                guid: element.globalId,
                projectId: new mongoose.Types.ObjectId(projectId),
              },
              update: {
                $set: {
                  name: element.name,
                  type: element.type,
                  volume: element.volume,
                  loadBearing: element.properties?.loadBearing || false,
                  isExternal: element.properties?.isExternal || false,
                  materials: processedMaterials,
                  updatedAt: new Date(),
                },
                $setOnInsert: {
                  projectId: new mongoose.Types.ObjectId(projectId),
                  uploadId: new mongoose.Types.ObjectId(uploadId),
                  createdAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

        const result = await Element.bulkWrite(bulkOps, { session });
        processedCount += result.upsertedCount + result.modifiedCount;

        logger.debug(`Processed batch ${i / BATCH_SIZE + 1}`, {
          batchSize: batch.length,
          totalProcessed: processedCount,
          upsertedCount: result.upsertedCount,
          modifiedCount: result.modifiedCount,
        });
      }

      // Update project emissions if there are matched materials
      const matchedMaterials = materials.filter((m) => m.kbobMatchId);
      if (matchedMaterials.length > 0) {
        try {
          const totals = await MaterialService.calculateProjectTotals(
            projectId
          );

          await Project.updateOne(
            { _id: new mongoose.Types.ObjectId(projectId) },
            {
              $set: {
                emissions: {
                  gwp: totals.totalGWP,
                  ubp: totals.totalUBP,
                  penre: totals.totalPENRE,
                  lastCalculated: new Date(),
                },
              },
            },
            { session }
          );

          logger.debug("Updated project emissions", {
            projectId,
            totals,
          });
        } catch (error) {
          logger.error("Failed to update project emissions", {
            error,
            projectId,
          });
        }
      }

      await MaterialService.updateProjectEmissions(projectId, session);

      return {
        elementCount: processedCount,
        materialCount: uniqueMaterialNames.size,
      };
    } catch (error) {
      logger.error("Error processing elements", { error });
      throw error;
    }
  }

  /**
   * Find and apply automatic material matches
   */
  static async findAutomaticMatches(
    projectId: string,
    materialNames: string[],
    session: ClientSession
  ) {
    try {
      logger.debug("Starting automatic material matching", {
        materialCount: materialNames.length,
        materials: materialNames,
      });

      const matches = await Promise.all(
        materialNames.map(async (name) => {
          const bestMatch = await MaterialService.findBestKBOBMatch(name);
          if (!bestMatch || bestMatch.score < 0.9) {
            logger.debug(`No good match found for material: ${name}`, {
              score: bestMatch?.score || 0,
            });
            return null;
          }

          logger.debug(`Found match for material: ${name}`, {
            kbobMaterial: bestMatch.kbobMaterial.Name,
            score: bestMatch.score,
          });

          return {
            name,
            kbobMatchId: bestMatch.kbobMaterial._id,
            density: MaterialService.calculateDensity(bestMatch.kbobMaterial),
            matchScore: bestMatch.score,
            autoMatched: true,
          };
        })
      );

      // Filter out failed matches and update materials with matches
      const validMatches = matches.filter((m) => m !== null);

      logger.debug("Automatic matching results", {
        totalMaterials: materialNames.length,
        validMatches: validMatches.length,
        matchedMaterials: validMatches.map((m) => m.name),
      });

      if (validMatches.length > 0) {
        const matchOps = validMatches.map((match) => ({
          updateOne: {
            filter: {
              name: match.name,
              projectId: new mongoose.Types.ObjectId(projectId),
            },
            update: {
              $set: {
                kbobMatchId: match.kbobMatchId,
                density: match.density,
                matchScore: match.matchScore,
                autoMatched: match.autoMatched,
                updatedAt: new Date(),
              },
            },
            upsert: false, // Don't create new materials, only update existing ones
          },
        }));

        const matchResult = await Material.bulkWrite(matchOps, { session });

        logger.debug("Material matching update result", {
          modifiedCount: matchResult.modifiedCount,
          matchedCount: matchResult.matchedCount,
        });
      }

      return {
        matchedCount: validMatches.length,
        totalCount: materialNames.length,
      };
    } catch (error) {
      logger.error("Error in automatic material matching", { error });
      throw error;
    }
  }
}
