import { Material, Element, Upload } from "@/models";
import { MaterialService } from "./material-service";
import mongoose from "mongoose";

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
      console.log('\n🚀 [IFC Parser] Starting material processing phase...');
      console.log(`📊 [IFC Parser] Processing ${materials.length} unique materials`);
      console.log('📋 [IFC Parser] Material categories:', [...new Set(materials.map(m => m.category))]);

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

      console.log(`✨ [IFC Parser] Found ${existingMatches.length} existing materials with KBOB matches`);
      console.log('📝 [IFC Parser] Existing material matches:', 
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
      console.log(`🔍 [IFC Parser] Looking for KBOB matches for ${unmatchedMaterials.length} new materials...`);

      for (const material of unmatchedMaterials) {
        console.log(`\n📦 [IFC Parser] Processing material "${material.name}"`);
        console.log(`   Category: ${material.category}`);
        console.log(`   Used in ${material.elements.length} elements`);
        
        const bestMatch = await MaterialService.findBestKBOBMatch(material.name);
        
        if (bestMatch && bestMatch.score >= 0.8) {
          console.log(`✅ [IFC Parser] High confidence match found:`);
          console.log(`   KBOB Material: ${bestMatch.kbobMaterial.Name}`);
          console.log(`   Match Score: ${(bestMatch.score * 100).toFixed(1)}%`);
          
          const density = MaterialService.calculateDensity(bestMatch.kbobMaterial);
          if (density) {
            matchMap.set(material.name, {
              kbobMatchId: bestMatch.kbobMaterial,
              density,
              matchScore: bestMatch.score
            });
          } else {
            console.warn(`⚠️ [IFC Parser] No density available for "${material.name}"`);
          }
        } else {
          console.warn(`⚠️ [IFC Parser] No high confidence match found for "${material.name}"`);
          if (bestMatch) {
            console.log(`   Best match was "${bestMatch.kbobMaterial.Name}" with score ${(bestMatch.score * 100).toFixed(1)}%`);
          }
        }
      }

      // Add KBOB match information to materials
      const materialsWithKBOB = materials.map(material => ({
        ...material,
        kbobMatch: matchMap.get(material.name)?.kbobMatchId,
        density: matchMap.get(material.name)?.density,
        matchScore: matchMap.get(material.name)?.matchScore
      }));

      console.log('\n📊 [IFC Parser] Material processing summary:');
      console.log(`   Total materials: ${materials.length}`);
      console.log(`   Materials with KBOB matches: ${materialsWithKBOB.filter(m => m.kbobMatch).length}`);
      console.log(`   Materials without matches: ${materialsWithKBOB.filter(m => !m.kbobMatch).length}`);

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

      console.log('✅ [IFC Parser] Material processing phase completed');
      return result;
    } catch (error) {
      console.error('❌ [IFC Parser] Error in material processing:', error);
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
        console.log('\n🚀 [IFC Parser] Starting element processing phase...');
        console.log(`📊 [IFC Parser] Processing ${elements.length} elements`);
        console.log('📋 [IFC Parser] Element categories:', [...new Set(elements.map(e => e.category))]);

        // First, get all materials from DB for this project
        const existingMaterials = await Material.find({ 
          projectId: new mongoose.Types.ObjectId(projectId) 
        }).select('_id name').lean();

        console.log(`📦 [IFC Parser] Found ${existingMaterials.length} materials in database`);

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

        console.log(`📦 [IFC Parser] Processing elements in ${batches.length} batches of ${batchSize}`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`\n🔄 [IFC Parser] Processing batch ${batchIndex + 1}/${batches.length}`);

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

        console.log('\n📊 [IFC Parser] Element processing summary:');
        console.log(`   Total elements processed: ${processedElements}`);
        console.log(`   Elements with missing materials: ${elementsWithMissingMaterials}`);
        console.log(`   Total material references: ${totalMaterialReferences}`);
        console.log(`   Successful material references: ${successfulMaterialReferences}`);
        console.log(`   Material reference success rate: ${((successfulMaterialReferences / totalMaterialReferences) * 100).toFixed(1)}%`);
        
        console.log('✅ [IFC Parser] Element processing phase completed');

        return {
          success: true,
          elementCount: processedElements
        };
      });
    } catch (error) {
      console.error('❌ [IFC Parser] Error in element processing:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
