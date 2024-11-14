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
      await session.withTransaction(async () => {
        // Process materials in batches to avoid memory issues
        const batchSize = 50;
        for (let i = 0; i < materials.length; i += batchSize) {
          const batch = materials.slice(i, i + batchSize);
          
          // Create or update materials
          const ops = await Promise.all(batch.map(async material => {
            // Find existing material with same name in project
            const existing = await Material.findOne({
              name: material.name,
              projectId: new mongoose.Types.ObjectId(projectId)
            }).select('kbobMatchId density').lean();

            const updateData = {
              category: material.category,
              volume: material.volume,
              updatedAt: new Date()
            };

            // If material exists with KBOB match, include those values
            if (existing?.kbobMatchId) {
              Object.assign(updateData, {
                kbobMatchId: existing.kbobMatchId,
                density: existing.density
              });
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
                    gwp: 0,
                    ubp: 0,
                    penre: 0
                  },
                  $set: updateData
                },
                upsert: true
              }
            };
          }));

          await Material.bulkWrite(ops, { session });
        }

        // Update upload status
        await Upload.findByIdAndUpdate(
          uploadId,
          {
            $set: {
              materialCount: materials.length,
              status: 'ProcessingElements' // New intermediate status
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
      await session.withTransaction(async () => {
        // Get all materials for this project
        const projectMaterials = await Material.find({
          projectId: new mongoose.Types.ObjectId(projectId)
        })
        .select('_id name kbobMatchId density')
        .lean();

        // Create material name to ID mapping
        const materialMap = new Map(
          projectMaterials.map(m => [m.name, { 
            _id: m._id,
            kbobMatchId: m.kbobMatchId,
            density: m.density
          }])
        );

        // Process elements in batches
        const batchSize = 50;
        for (let i = 0; i < elements.length; i += batchSize) {
          const batch = elements.slice(i, i + batchSize);
          
          const ops = batch.map(element => ({
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
                  materials: element.materials.map(mat => {
                    const materialInfo = materialMap.get(mat.material);
                    return {
                      material: materialInfo?._id,
                      volume: mat.volume,
                      fraction: mat.fraction
                    };
                  }),
                  updatedAt: new Date()
                }
              },
              upsert: true
            }
          }));

          await Element.bulkWrite(ops, { session });
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

        // Trigger LCA calculations for elements with matched materials
        const matchedMaterials = projectMaterials
          .filter(m => m.kbobMatchId)
          .map(m => m._id);

        if (matchedMaterials.length > 0) {
          // Don't await this - let it run in background
          MaterialService.recalculateElementsForMaterials(matchedMaterials)
            .catch(error => console.error('Error recalculating elements:', error));
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
