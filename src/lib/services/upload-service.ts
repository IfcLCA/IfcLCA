import { Material, Element, Upload } from "@/models";
import { MaterialService } from "./material-service";
import mongoose from "mongoose";

export class UploadService {
  /**
   * Process materials from an IFC file upload
   */
  static async processMaterials(
    projectId: string,
    materials: Array<{
      name: string;
      category: string;
      volume: number;
    }>,
    uploadId: string
  ) {
    const session = await mongoose.startSession();
    try {
      console.log('🔍 [processMaterials] Starting material processing...');
      console.log('📋 [processMaterials] Material names to process:', materials.map(m => m.name));

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

      console.log(`🎯 [processMaterials] Found ${existingMatches.length} existing materials with KBOB matches:`, 
        existingMatches.map(m => ({
          name: m.name,
          kbobId: m.kbobMatchId?._id,
          kbobName: m.kbobMatchId?.Name,
          density: m.density,
          kbobData: m.kbobMatchId ? {
            gwp: m.kbobMatchId.GWP,
            ubp: m.kbobMatchId.UBP,
            penre: m.kbobMatchId.PENRE,
            kgPerUnit: m.kbobMatchId['kg/unit'],
            minDensity: m.kbobMatchId.min_density,
            maxDensity: m.kbobMatchId.max_density
          } : null
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
      for (const material of materials) {
        if (!matchMap.has(material.name)) {
          console.log(`🔍 [processMaterials] Looking for KBOB match for new material "${material.name}"...`);
          const bestMatch = await MaterialService.findBestKBOBMatch(material.name);
          
          if (bestMatch && bestMatch.score >= 0.8) { // Only use matches with high confidence
            console.log(`✨ [processMaterials] Found KBOB match for "${material.name}":`, {
              kbobName: bestMatch.kbobMaterial.Name,
              score: bestMatch.score
            });
            
            const density = MaterialService.calculateDensity(bestMatch.kbobMaterial);
            if (density) {
              matchMap.set(material.name, {
                kbobMatchId: bestMatch.kbobMaterial,
                density,
                matchScore: bestMatch.score
              });
            } else {
              console.log(`⚠️ [processMaterials] No valid density found for KBOB match "${bestMatch.kbobMaterial.Name}"`);
            }
          } else {
            console.log(`⚠️ [processMaterials] No good KBOB match found for "${material.name}"`, 
              bestMatch ? `(best score: ${bestMatch.score})` : '');
          }
        }
      }

      console.log('🗺️ [processMaterials] Final match map with entries:', 
        Array.from(matchMap.entries()).map(([name, data]) => ({
          name,
          hasKbob: !!data.kbobMatchId,
          density: data.density,
          kbobId: data.kbobMatchId?._id,
          matchScore: data.matchScore
        }))
      );

      await session.withTransaction(async () => {
        // Process materials in batches to avoid memory issues
        const batchSize = 50;
        const batches = materials.reduce((acc, material, index) => {
          const chunkIndex = Math.floor(index / batchSize);
          if (!acc[chunkIndex]) {
            acc[chunkIndex] = [];
          }
          acc[chunkIndex].push(material);
          return acc;
        }, []);

        for (const batch of batches) {
          console.log(`📦 [processMaterials] Processing batch of ${batch.length} materials`);
          
          // Create or update materials
          const ops = batch.map(material => {
            const existingMatch = matchMap.get(material.name);
            console.log(`🔄 [processMaterials] Processing material "${material.name}":`, {
              hasExistingMatch: !!existingMatch,
              kbobId: existingMatch?.kbobMatchId?._id,
              density: existingMatch?.density,
              volume: material.volume
            });

            const updateData = {
              category: material.category,
              volume: material.volume,
              updatedAt: new Date()
            };

            // If we have a KBOB match, calculate indicators
            if (existingMatch?.kbobMatchId && existingMatch?.density) {
              console.log(`📊 [processMaterials] Found KBOB match for "${material.name}":`, {
                volume: material.volume,
                density: existingMatch.density,
                kbobData: {
                  id: existingMatch.kbobMatchId._id,
                  name: existingMatch.kbobMatchId.Name,
                  gwp: existingMatch.kbobMatchId.GWP,
                  ubp: existingMatch.kbobMatchId.UBP,
                  penre: existingMatch.kbobMatchId.PENRE
                }
              });

              const indicators = MaterialService.calculateIndicators(
                material.volume,
                existingMatch.density,
                existingMatch.kbobMatchId
              );

              console.log(`✨ [processMaterials] Calculated indicators for "${material.name}":`, indicators);

              if (indicators) {
                Object.assign(updateData, {
                  kbobMatchId: existingMatch.kbobMatchId._id,
                  density: existingMatch.density,
                  autoMatched: true,
                  gwp: indicators.gwp,
                  ubp: indicators.ubp,
                  penre: indicators.penre
                });
              }
            } else {
              console.log(`⚠️ [processMaterials] No KBOB match found for "${material.name}"`);
            }

            return {
              updateOne: {
                filter: { 
                  name: material.name,
                  projectId: new mongoose.Types.ObjectId(projectId)
                },
                update: {
                  $setOnInsert: {
                    name: material.name,
                    projectId: new mongoose.Types.ObjectId(projectId),
                    createdAt: new Date()
                  },
                  $set: updateData
                },
                upsert: true
              }
            };
          });

          const result = await Material.bulkWrite(ops, { session });
          console.log(`[processMaterials] Batch processed:`, {
            matched: result.matchedCount,
            modified: result.modifiedCount,
            upserted: result.upsertedCount
          });
        }

        // Update upload status
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            $set: {
              materialCount: materials.length,
              status: 'ProcessingElements'
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process elements from an IFC file upload
   */
  static async processElements(
    projectId: string,
    elements: Array<{
      guid: string;
      name: string;
      type: string;
      volume: number;
      materials: Array<{
        material: string; // material name
        volume: number;
        fraction: number;
      }>;
    }>,
    uploadId: string
  ) {
    const session = await mongoose.startSession();
    try {
      console.log(`🔍 [processElements] Starting element processing for project ${projectId}`);
      console.log(`📋 [processElements] Processing ${elements.length} elements`);

      // Get all materials for this project
      const projectMaterials = await Material.find({
        projectId: new mongoose.Types.ObjectId(projectId)
      })
      .select('_id name kbobMatchId density')
      .populate({
        path: 'kbobMatchId',
        select: 'Name GWP UBP PENRE kg/unit min_density max_density'
      })
      .lean();

      console.log(`🎯 [processElements] Found ${projectMaterials.length} materials in project`);
      console.log('[processElements] Materials:', projectMaterials.map(m => ({
        id: m._id,
        name: m.name,
        hasKbobMatch: !!m.kbobMatchId,
        kbobDetails: m.kbobMatchId ? {
          id: m.kbobMatchId._id,
          name: m.kbobMatchId.Name,
          gwp: m.kbobMatchId.GWP,
          ubp: m.kbobMatchId.UBP,
          penre: m.kbobMatchId.PENRE,
          density: m.density || m.kbobMatchId['kg/unit'] || 
            (m.kbobMatchId['min_density'] && m.kbobMatchId['max_density'] ? 
              (m.kbobMatchId['min_density'] + m.kbobMatchId['max_density']) / 2 : undefined)
        } : null,
        density: m.density
      })));

      // Create material name to ID mapping with KBOB data
      const materialMap = new Map(
        projectMaterials.map(m => [m.name, { 
          _id: m._id,
          kbobMatchId: m.kbobMatchId,
          density: m.density || (m.kbobMatchId && MaterialService.calculateDensity(m.kbobMatchId))
        }])
      );

      console.log('[processElements] Material map:', {
        keys: Array.from(materialMap.keys()),
        entries: Array.from(materialMap.entries()).map(([key, value]) => ({
          name: key,
          hasKbobMatch: !!value.kbobMatchId,
          hasDensity: !!value.density
        }))
      });

      await session.withTransaction(async () => {
        // Process elements in batches
        const batchSize = 50;
        let totalElementsWithIndicators = 0;
        let totalMaterialsProcessed = 0;
        let totalMaterialsWithIndicators = 0;

        for (let i = 0; i < elements.length; i += batchSize) {
          const batch = elements.slice(i, i + batchSize);
          console.log(`📦 [processElements] Processing batch ${i/batchSize + 1}, size: ${batch.length}`);
          
          const ops = batch.map(element => {
            console.log(`🔄 [processElements] Processing element: ${element.guid}`);
            console.log(`📋 [processElements] Element materials:`, element.materials);

            const processedMaterials = element.materials.map(mat => {
              const materialInfo = materialMap.get(mat.material);
              console.log(`🔍 [processElements] Processing material "${mat.material}":`, {
                found: !!materialInfo,
                hasKbobMatch: !!materialInfo?.kbobMatchId,
                hasDensity: !!materialInfo?.density,
                volume: mat.volume,
                fraction: mat.fraction
              });
              
              totalMaterialsProcessed++;
              
              // Calculate indicators if material has KBOB match
              let indicators;
              if (materialInfo?.kbobMatchId) {
                console.log(`📊 [processElements] Attempting to calculate indicators for "${mat.material}":`, {
                  volume: mat.volume,
                  density: materialInfo.density,
                  kbobMatch: {
                    name: materialInfo.kbobMatchId.Name,
                    gwp: materialInfo.kbobMatchId.GWP,
                    ubp: materialInfo.kbobMatchId.UBP,
                    penre: materialInfo.kbobMatchId.PENRE
                  }
                });
                
                indicators = MaterialService.calculateIndicators(
                  mat.volume,
                  materialInfo.density,
                  materialInfo.kbobMatchId
                );
                
                if (indicators) {
                  totalMaterialsWithIndicators++;
                  console.log(`✨ [processElements] Successfully calculated indicators for "${mat.material}":`, indicators);
                } else {
                  console.log(`⚠️ [processElements] Failed to calculate indicators for "${mat.material}" despite having KBOB match`);
                }
              } else {
                console.log(`🚫 [processElements] No indicators calculated for "${mat.material}" - missing KBOB match or density`);
              }

              const result = {
                material: materialInfo?._id,
                volume: mat.volume,
                fraction: mat.fraction,
                ...(indicators && { indicators })
              };

              console.log(`📈 [processElements] Final material data:`, {
                materialName: mat.material,
                hasKbobMatch: !!materialInfo?.kbobMatchId,
                hasDensity: !!materialInfo?.density,
                hasIndicators: !!indicators,
                result
              });
              return result;
            });

            if (processedMaterials.some(m => m.indicators)) {
              totalElementsWithIndicators++;
            }

            return {
              updateOne: {
                filter: {
                  guid: element.guid,
                  projectId: new mongoose.Types.ObjectId(projectId)
                },
                update: {
                  $setOnInsert: {
                    createdAt: new Date()
                  },
                  $set: {
                    name: element.name,
                    type: element.type,
                    volume: element.volume,
                    materials: processedMaterials,
                    updatedAt: new Date()
                  }
                },
                upsert: true
              }
            };
          });

          const bulkWriteResult = await Element.bulkWrite(ops, { session });
          console.log(`📊 [processElements] Bulk write result:`, {
            matchedCount: bulkWriteResult.matchedCount,
            modifiedCount: bulkWriteResult.modifiedCount,
            upsertedCount: bulkWriteResult.upsertedCount
          });
        }

        // Update upload status
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            $set: {
              elementCount: elements.length,
              status: 'Completed'
            }
          },
          { session }
        );

        // Log final statistics
        const matchedMaterialsCount = projectMaterials.filter(m => m.kbobMatchId).length;
        console.log(`📊 [processElements] Final statistics:`, {
          totalElements: elements.length,
          totalElementsWithIndicators,
          totalMaterials: totalMaterialsProcessed,
          totalMaterialsWithIndicators,
          matchedMaterialsCount,
          totalProjectMaterials: projectMaterials.length
        });
      });
    } catch (error) {
      console.error('[processElements] Error processing elements:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
