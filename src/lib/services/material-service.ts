import { Material, KBOBMaterial, Element } from "@/models";
import mongoose from "mongoose";

interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

export class MaterialService {
  /**
   * Sets a KBOB material match for given materials
   */
  static async setKBOBMatch(materialIds: string[], kbobMaterialId: string) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const kbobMaterial = await KBOBMaterial.findById(kbobMaterialId).lean();
        if (!kbobMaterial) {
          throw new Error("KBOB material not found");
        }

        const density = this.calculateDensity(kbobMaterial);
        if (!density) {
          throw new Error("Invalid density in KBOB material");
        }

        // Update materials with KBOB match and density
        const objectIds = materialIds.map(id => new mongoose.Types.ObjectId(id));
        await Material.updateMany(
          { _id: { $in: objectIds } },
          {
            $set: {
              kbobMatchId: new mongoose.Types.ObjectId(kbobMaterialId),
              density: density,
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // Don't await recalculation - let it run in background
        this.recalculateElementsForMaterials(objectIds)
          .catch(error => console.error('Error recalculating elements:', error));
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Calculates LCA indicators for given volume and material
   */
  static calculateIndicators(
    volume: number,
    density: number,
    kbobMaterial: any
  ): ILCAIndicators {
    const mass = volume * density;
    return {
      gwp: mass * kbobMaterial.GWP,
      ubp: mass * kbobMaterial.UBP,
      penre: mass * kbobMaterial.PENRE
    };
  }

  /**
   * Recalculates LCA values for elements using specified materials
   */
  static async recalculateElementsForMaterials(materialIds: mongoose.Types.ObjectId[]) {
    const batchSize = 500;
    let processedCount = 0;

    while (true) {
      // Get batch of elements with their materials and KBOB data
      const elements = await Element.find({
        "materials.material": { $in: materialIds }
      })
        .skip(processedCount)
        .limit(batchSize)
        .populate({
          path: "materials.material",
          populate: {
            path: "kbobMatchId",
            model: "KBOBMaterial"
          }
        });

      if (elements.length === 0) break;

      // Prepare bulk operations for this batch
      const bulkOps = elements.map(element => ({
        updateOne: {
          filter: { _id: element._id },
          update: {
            $set: {
              materials: element.materials.map(mat => {
                if (!mat.material?.kbobMatchId) return mat;

                return {
                  _id: mat._id,
                  material: mat.material._id,
                  volume: mat.volume,
                  fraction: mat.fraction,
                  indicators: this.calculateIndicators(
                    mat.volume,
                    mat.material.density,
                    mat.material.kbobMatchId
                  )
                };
              }),
              updatedAt: new Date()
            }
          }
        }
      }));

      if (bulkOps.length > 0) {
        await Element.bulkWrite(bulkOps, { ordered: false });
      }

      processedCount += elements.length;
    }
  }

  /**
   * Calculate density from KBOB material data
   */
  private static calculateDensity(kbobMaterial: any): number | null {
    if (kbobMaterial["kg/unit"] && typeof kbobMaterial["kg/unit"] === "number") {
      return kbobMaterial["kg/unit"];
    } 
    if (kbobMaterial["min density"] && kbobMaterial["max density"]) {
      return (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }
    return null;
  }
}
