import { Material, Element, Upload } from "@/models";
import { MaterialService } from "./material-service";
import mongoose from "mongoose";
import { logger } from '@/lib/logger';

export class UploadService {
  /**
   * Process materials from an Ifc file upload
   */
  static async processMaterials(
    projectId: string,
    materials: Array<{
      name: string;
      category: string;
      elements: Array<{
        id: string;
        name: string;
        volume: number;
        materials: Array<{
          name: string;
          thickness: number;
        }>;
      }>;
    }>,
    uploadId: string
  ) {
    const session = await mongoose.startSession();
    try {
      logger.info('Starting material processing phase');
      logger.info(`Processing ${materials.length} unique materials`);
      logger.info('Material categories:', [...new Set(materials.map(m => m.category))]);

      // First, get all existing materials with KBOB matches from any project
      const existingMatches = await Material.find({
        name: { $in: materials.map(m => m.name) },
        kbobMatchId: { $exists: true }
      })
      .select('name kbobMatchId density')
      .populate({
        path: 'kbobMatchId',
        select: 'Name GWP UBP PENRE kg/unit min_density max_density'
      });  

      logger.info(`Found ${existingMatches.length} existing materials with KBOB matches`);
      logger.debug('Existing material matches:', 
        existingMatches.map(m => ({
          name: m.name,
          kbobName: m.kbobMatchId?.Name,
          density: m.density
        }))
      );

      // Create a map of material names to their KBOB matches
      const matchMap = new Map();
      
      // First add existing matches
      for (const match of existingMatches) {
        matchMap.set(match.name, {
          kbobMatchId: match.kbobMatchId,  
          density: match.density || (match.kbobMatchId && MaterialService.calculateDensity(match.kbobMatchId))
        });
      }

      // Then try to find matches for any remaining materials
      const unmatchedMaterials = materials.filter(m => !matchMap.has(m.name));
      logger.info(`Looking for KBOB matches for ${unmatchedMaterials.length} new materials`);

      for (const material of unmatchedMaterials) {
        logger.debug('Processing material', { 
          name: material.name,
          category: material.category,
          elementCount: material.elements.length
        });
        
        const bestMatch = await MaterialService.findBestKBOBMatch(material.name);
        
        if (bestMatch && bestMatch.score >= 0.8) {
          logger.info('High confidence match found', {
            material: material.name,
            kbobMaterial: bestMatch.kbobMaterial.Name,
            matchScore: (bestMatch.score * 100).toFixed(1) + '%'
          });
          
          const density = MaterialService.calculateDensity(bestMatch.kbobMaterial);
          if (density) {
            matchMap.set(material.name, {
              kbobMatchId: bestMatch.kbobMaterial,
              density,
              matchScore: bestMatch.score
            });
          } else {
            logger.warn(`No density available for "${material.name}"`);
          }
        } else {
          logger.warn(`No high confidence match found for "${material.name}"`, {
            bestMatch: bestMatch ? {
              name: bestMatch.kbobMaterial.Name,
              score: (bestMatch.score * 100).toFixed(1) + '%'
            } : null
          });
        }
      }

      // Add KBOB match information to materials
      const materialsWithKBOB = materials.map(material => ({
        ...material,
        kbobMatch: matchMap.get(material.name)?.kbobMatchId,
        density: matchMap.get(material.name)?.density,
        matchScore: matchMap.get(material.name)?.matchScore
      }));

      const matchedCount = materialsWithKBOB.filter(m => m.kbobMatch).length;
      const unmatchedCount = materialsWithKBOB.filter(m => !m.kbobMatch).length;

      logger.info('Material processing summary', {
        totalMaterials: materials.length,
        materialsWithKBOBMatches: matchedCount,
        materialsWithoutMatches: unmatchedCount
      });

      // Let MaterialService handle the actual material processing
      const result = await MaterialService.processMaterials(projectId, materialsWithKBOB, uploadId);

      // Update upload status
      await Upload.findByIdAndUpdate(
        uploadId,
        {
          $set: {
            materialCount: result.materialCount,
            status: 'ProcessingElements'
          }
        },
        { session }
      );

      logger.info('Material processing phase completed');
      return result;
    } catch (error) {
      logger.error('Error in material processing', { error });
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
        logger.info('Starting element processing phase');
        logger.info(`Processing ${elements.length} elements`);
        logger.info('Element categories:', [...new Set(elements.map(e => e.category))]);

        // First, get all materials from DB for this project
        const existingMaterials = await Material.find({ 
          projectId: new mongoose.Types.ObjectId(projectId) 
        }).select('_id name').lean();

        logger.info(`Found ${existingMaterials.length} materials in database`);

        // Create a map for quick lookups, normalize material names
        const materialMap = new Map(
          existingMaterials.map(m => [m.name.trim().toLowerCase(), m._id])
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

        logger.info(`Processing elements in ${batches.length} batches of ${batchSize}`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);

          const ops = batch.map(element => {
            // Map material references
            const materialRefs = element.materials
              .map(material => {
                totalMaterialReferences++;
                const normalizedName = material.name.trim().toLowerCase();
                const materialId = materialMap.get(normalizedName);
                
                if (!materialId) {
                  return null;
                }

                successfulMaterialReferences++;
                return {
                  materialId,
                  thickness: material.thickness
                };
              })
              .filter((ref): ref is { materialId: any; thickness: number } => ref !== null);

            if (materialRefs.length === 0) {
              elementsWithMissingMaterials++;
            }

            return {
              updateOne: {
                filter: {
                  projectId: new mongoose.Types.ObjectId(projectId),
                  elementId: element.id
                },
                update: {
                  $setOnInsert: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    elementId: element.id,
                    createdAt: new Date()
                  },
                  $set: {
                    name: element.name,
                    category: element.category,
                    volume: element.volume,
                    materials: materialRefs,
                    updatedAt: new Date()
                  }
                },
                upsert: true
              }
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
              status: 'Completed'
            }
          },
          { session }
        );

        const successRate = ((successfulMaterialReferences / totalMaterialReferences) * 100).toFixed(1);
        logger.info('Element processing summary', {
          totalElementsProcessed: processedElements,
          elementsWithMissingMaterials,
          totalMaterialReferences,
          successfulMaterialReferences,
          materialReferenceSuccessRate: `${successRate}%`
        });
        
        logger.info('Element processing phase completed');

        return {
          success: true,
          elementCount: processedElements
        };
      });
    } catch (error) {
      logger.error('Error in element processing', { error });
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
