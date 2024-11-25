import {
  Material,
  KBOBMaterial,
  Element,
  Types,
  ClientSession,
  Project,
} from "@/models";
import mongoose from "mongoose";

// Interfaces for better type safety
interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

interface IKBOBMaterial {
  _id: Types.ObjectId;
  Name: string;
  Category: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "kg/unit"?: number;
  "min density"?: number;
  "max density"?: number;
}

interface IMaterialChange {
  materialId: string;
  materialName: string;
  oldKbobMatch?: string;
  newKbobMatch: string;
  oldDensity?: number;
  newDensity: number;
  affectedElements: number;
  projects: string[];
}

interface IMaterialPreview {
  changes: IMaterialChange[];
}

export class MaterialService {
  // Cache for frequently accessed data
  private static materialCache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Sets KBOB material match for all materials with the same name across all projects
   */
  static async setKBOBMatch(
    materialId: Types.ObjectId,
    kbobMatchId: Types.ObjectId,
    density?: number,
    session?: ClientSession
  ): Promise<number> {
    const referenceMaterial = await Material.findById(materialId)
      .select("name projectId")
      .session(session)
      .lean();

    if (!referenceMaterial?.name) {
      console.error("❌ [Material Service] Material not found:", materialId);
      throw new Error(`Material ${materialId} not found or has no name`);
    }

    console.log(
      `\n🔄 [Material Service] Updating KBOB match for "${referenceMaterial.name}"`
    );
    console.log(`   Material ID: ${materialId}`);
    console.log(`   KBOB Match ID: ${kbobMatchId}`);
    if (density) console.log(`   Density: ${density} kg/m³`);

    // Use a transaction if one wasn't provided
    const useSession = session || (await mongoose.startSession());
    if (!session) {
      useSession.startTransaction();
    }

    try {
      // Update all materials with this name
      const updateResult = await Material.updateMany(
        { name: referenceMaterial.name },
        {
          $set: {
            kbobMatchId,
            ...(density !== undefined ? { density } : {}),
            updatedAt: new Date(),
          },
        },
        { session: useSession }
      );

      // Verify the update
      const updatedMaterials = await Material.find({
        name: referenceMaterial.name,
      })
        .select("_id name projectId kbobMatchId density")
        .populate("projectId", "name")
        .session(useSession)
        .lean();

      console.log("\n📊 [Material Service] Update results:");
      console.log(`   Materials updated: ${updateResult.modifiedCount}`);
      console.log(
        `   Projects affected: ${new Set(updatedMaterials.map((m) => m.projectId?.name)).size
        }`
      );

      // Recalculate affected elements
      console.log("\n🔄 [Material Service] Recalculating affected elements...");
      const recalcResult = await this.recalculateElementsForMaterials(
        updatedMaterials.map((m) => m._id),
        useSession
      );

      if (!session) {
        await useSession.commitTransaction();
      }

      console.log("\n✅ [Material Service] KBOB match update completed:");
      console.log(`   Materials updated: ${updateResult.modifiedCount}`);
      console.log(`   Elements recalculated: ${recalcResult}`);

      return updateResult.modifiedCount;
    } catch (error) {
      if (!session) {
        await useSession.abortTransaction();
      }
      console.error("❌ [Material Service] Error updating KBOB match:", error);
      throw error;
    } finally {
      if (!session) {
        await useSession.endSession();
      }
    }
  }

  /**
   * Recalculates elements for given materials with efficient batching
   */
  static async recalculateElementsForMaterials(
    materialIds: Types.ObjectId[],
    session?: ClientSession
  ): Promise<number> {
    const BATCH_SIZE = 500;
    let totalModified = 0;

    console.log(
      `\n🔄 [Material Service] Starting element recalculation for ${materialIds.length} materials`
    );

    // Get all materials with their KBOB matches in one query
    const materials = await Material.find({ _id: { $in: materialIds } })
      .select("_id name kbobMatchId density")
      .populate<{ kbobMatchId: IKBOBMaterial }>("kbobMatchId")
      .session(session)
      .lean();

    if (!materials.length) {
      console.log("ℹ️ [Material Service] No materials found to process");
      return 0;
    }

    console.log(
      `📦 [Material Service] Loaded ${materials.length} materials with KBOB data`
    );

    const materialMap = new Map(materials.map((m) => [m._id.toString(), m]));

    try {
      // Count total elements to process
      const totalElements = await Element.countDocuments({
        "materials.material": { $in: materialIds },
      }).session(session);

      console.log(
        `\n📊 [Material Service] Found ${totalElements} elements to process`
      );
      console.log(`   Batch size: ${BATCH_SIZE}`);
      console.log(`   Total batches: ${Math.ceil(totalElements / BATCH_SIZE)}`);

      // Process in batches
      for (let skip = 0; skip < totalElements; skip += BATCH_SIZE) {
        const batchNumber = Math.floor(skip / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalElements / BATCH_SIZE);

        console.log(
          `\n🔄 [Material Service] Processing batch ${batchNumber}/${totalBatches}`
        );

        const elements = await Element.find({
          "materials.material": { $in: materialIds },
        })
          .skip(skip)
          .limit(BATCH_SIZE)
          .session(session);

        const bulkOps = elements.map((element) => ({
          updateOne: {
            filter: { _id: element._id },
            update: {
              $set: {
                materials: element.materials.map((mat) => {
                  const material = materialMap.get(mat.material.toString());
                  if (!material) return mat;

                  const indicators = this.calculateIndicators(
                    mat.volume,
                    material.density,
                    material.kbobMatchId
                  );

                  return {
                    ...mat,
                    indicators,
                  };
                }),
                updatedAt: new Date(),
              },
            },
          },
        }));

        if (bulkOps.length) {
          const result = await Element.bulkWrite(bulkOps, {
            ordered: false,
            session,
            writeConcern: { w: 1 },
          });

          totalModified += result.modifiedCount;
          console.log(
            `   ✓ Modified ${result.modifiedCount} elements in this batch`
          );
          console.log(`   ✓ Total modified so far: ${totalModified}`);
        }
      }

      console.log("\n✅ [Material Service] Element recalculation completed");
      console.log(`   Total elements modified: ${totalModified}`);

      return totalModified;
    } catch (error) {
      console.error(
        "❌ [Material Service] Error in element recalculation:",
        error
      );
      throw error;
    }
  }

  /**
   * Gets preview of material changes with caching
   */
  static async getKBOBMatchPreview(
    materialIds: string[],
    kbobMatchId: string,
    density?: number
  ): Promise<IMaterialPreview> {
    const cacheKey = `preview-${materialIds.join(
      "-"
    )}-${kbobMatchId}-${density}`;
    const cached = MaterialService.materialCache.get(cacheKey);
    if (cached?.timestamp > Date.now() - MaterialService.cacheTimeout) {
      return cached.data;
    }

    try {
      const objectIds = materialIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const kbobObjectId = new mongoose.Types.ObjectId(kbobMatchId);

      const [materials, newKBOBMaterial, elements] = await Promise.all([
        Material.find({ _id: { $in: objectIds } })
          .populate<{ kbobMatchId: IKBOBMaterial }>("kbobMatchId")
          .lean(),
        KBOBMaterial.findById<IKBOBMaterial>(kbobObjectId).lean(),
        Element.find({ "materials.material": { $in: objectIds } })
          .populate("projectId", "name")
          .lean(),
      ]);

      if (!newKBOBMaterial) {
        throw new Error("KBOB material not found");
      }

      // Calculate affected elements per material
      const elementCounts = new Map<string, number>();
      const projectMap = new Map<string, Set<string>>();

      elements.forEach((element) => {
        const projectName = element.projectId?.name;
        if (!projectName) return;

        element.materials.forEach((mat) => {
          const materialId = mat.material.toString();
          elementCounts.set(
            materialId,
            (elementCounts.get(materialId) || 0) + 1
          );

          if (!projectMap.has(materialId)) {
            projectMap.set(materialId, new Set());
          }
          projectMap.get(materialId)?.add(projectName);
        });
      });

      const changes: IMaterialChange[] = materials.map((material) => ({
        materialId: material._id.toString(),
        materialName: material.name,
        oldKbobMatch: material.kbobMatchId?.Name,
        newKbobMatch: newKBOBMaterial.Name,
        oldDensity: material.density,
        newDensity:
          density ||
          newKBOBMaterial["kg/unit"] ||
          (newKBOBMaterial["min density"] && newKBOBMaterial["max density"]
            ? (newKBOBMaterial["min density"] +
              newKBOBMaterial["max density"]) /
            2
            : 0),
        affectedElements: elementCounts.get(material._id.toString()) || 0,
        projects: Array.from(
          projectMap.get(material._id.toString()) || new Set()
        ).sort(),
      }));

      const preview = { changes };
      MaterialService.materialCache.set(cacheKey, {
        data: preview,
        timestamp: Date.now(),
      });

      return preview;
    } catch (error) {
      console.error(
        "❌ [Material Service] Error in getKBOBMatchPreview:",
        error
      );
      throw error;
    }
  }

  /**
   * Finds best matching KBOB material with improved matching logic
   */
  static async findBestKBOBMatch(
    materialName: string
  ): Promise<{ kbobMaterial: IKBOBMaterial; score: number } | null> {
    const cleanedName = materialName.trim();

    try {
      // Try exact match first
      const exactMatch = await KBOBMaterial.findOne<IKBOBMaterial>({
        Name: cleanedName,
      }).lean();

      if (exactMatch) {
        return { kbobMaterial: exactMatch, score: 1.0 };
      }

      // Try case-insensitive match
      const caseInsensitiveMatch = await KBOBMaterial.findOne<IKBOBMaterial>({
        Name: { $regex: `^${cleanedName}$`, $options: "i" },
      }).lean();

      if (caseInsensitiveMatch) {
        return { kbobMaterial: caseInsensitiveMatch, score: 0.99 };
      }

      return null;
    } catch (error) {
      console.error("❌ [Material Service] Error in findBestKBOBMatch:", error);
      throw error;
    }
  }

  /**
   * Calculates density from KBOB material with validation
   */
  static calculateDensity(kbobMaterial: IKBOBMaterial): number | null {
    if (!kbobMaterial) return null;

    // Use kg/unit if available
    if (
      typeof kbobMaterial["kg/unit"] === "number" &&
      !isNaN(kbobMaterial["kg/unit"])
    ) {
      return kbobMaterial["kg/unit"];
    }

    // Calculate from min/max density
    if (
      typeof kbobMaterial["min density"] === "number" &&
      typeof kbobMaterial["max density"] === "number" &&
      !isNaN(kbobMaterial["min density"]) &&
      !isNaN(kbobMaterial["max density"])
    ) {
      return (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }

    return null;
  }

  /**
   * Calculates LCA indicators with validation
   */
  static calculateIndicators(
    volume: number,
    density: number | undefined,
    kbobMaterial: IKBOBMaterial | null
  ): ILCAIndicators | undefined {
    if (!kbobMaterial || !density || density <= 0 || !volume || isNaN(volume)) {
      return undefined;
    }

    if (
      typeof kbobMaterial.GWP !== "number" ||
      typeof kbobMaterial.UBP !== "number" ||
      typeof kbobMaterial.PENRE !== "number"
    ) {
      return undefined;
    }

    const mass = volume * density;
    return {
      gwp: mass * kbobMaterial.GWP,
      ubp: mass * kbobMaterial.UBP,
      penre: mass * kbobMaterial.PENRE,
    };
  }

  /**
   * Gets projects with materials using efficient queries
   */
  static async getProjectsWithMaterials(): Promise<
    Array<{
      id: string;
      name: string;
      materialIds: string[];
    }>
  > {
    try {
      const [projects, elements] = await Promise.all([
        Project.find().lean(),
        Element.find()
          .select("materials.material projectId")
          .populate("projectId", "name")
          .lean(),
      ]);

      const projectMaterials = new Map<string, Set<string>>();
      projects.forEach((project) => {
        projectMaterials.set(project._id.toString(), new Set());
      });

      elements.forEach((element) => {
        if (
          element.projectId &&
          typeof element.projectId === "object" &&
          "_id" in element.projectId
        ) {
          const projectId = element.projectId._id.toString();
          const materialSet = projectMaterials.get(projectId) || new Set();

          element.materials.forEach((mat) => {
            if (mat.material) {
              const materialId =
                typeof mat.material === "string"
                  ? mat.material
                  : mat.material.toString();
              materialSet.add(materialId);
            }
          });

          projectMaterials.set(projectId, materialSet);
        }
      });

      return projects.map((project) => ({
        id: project._id.toString(),
        name: project.name,
        materialIds: Array.from(
          projectMaterials.get(project._id.toString()) || new Set()
        ),
      }));
    } catch (error) {
      console.error(
        "❌ [Material Service] Error in getProjectsWithMaterials:",
        error
      );
      throw error;
    }
  }

  /**
   * Finds existing material match across all projects
   */
  static async findExistingMaterial(
    materialName: string
  ): Promise<Material | null> {
    const cleanedName = materialName.trim().toLowerCase();
    console.log(
      `[Material Service] Searching for material match across all projects`,
      {
        originalName: materialName,
        cleanedName,
      }
    );

    try {
      // Try exact match first
      const exactMatch = await Material.findOne({
        name: materialName,
        kbobMatchId: { $exists: true },
      })
        .populate("kbobMatchId")
        .lean();

      if (exactMatch) {
        console.log(
          `[Material Service] Found exact match for "${materialName}"`
        );
        return exactMatch;
      }

      // Try case-insensitive match
      const caseInsensitiveMatch = await Material.findOne({
        name: { $regex: `^${cleanedName}$`, $options: "i" },
        kbobMatchId: { $exists: true },
      })
        .populate("kbobMatchId")
        .lean();

      if (caseInsensitiveMatch) {
        console.log(
          `[Material Service] Found case-insensitive match for "${materialName}"`
        );
        return caseInsensitiveMatch;
      }

      console.log(
        `[Material Service] No existing material match found for "${materialName}"`
      );
      return null;
    } catch (error) {
      console.error(
        "[Material Service] Error finding existing material:",
        error
      );
      return null;
    }
  }

  /**
   * Processes materials after IFC upload with validation
   */
  static async processMaterials(
    projectId: string,
    elements: Array<{
      globalId: string;
      type: string;
      name: string;
      netVolume?: number;
      materialLayers?: {
        layerSetName?: string;
        layers: Array<{
          materialName: string;
          thickness: number;
          layerId?: string;
          layerName?: string;
        }>;
      };
    }>,
    uploadId: string,
    session: mongoose.ClientSession
  ) {


    try {
      // Group materials by name and accumulate volumes
      const materialsByName = elements.reduce((acc: { [key: string]: any }, element) => {
        if (!element.materialLayers?.layers) return acc;

        const totalThickness = element.materialLayers.layers.reduce(
          (sum, layer) => sum + (layer.thickness || 0),
          0
        );

        element.materialLayers.layers.forEach(layer => {
          if (!layer.materialName) return;

          const materialKey = layer.materialName.trim().toLowerCase();
          if (!acc[materialKey]) {
            acc[materialKey] = {
              name: layer.materialName,
              volume: 0,
              elements: []
            };
          }

          // Calculate volume fraction for this layer
          const volumeFraction = totalThickness > 0 ? (layer.thickness || 0) / totalThickness : 0;
          const layerVolume = (element.netVolume || 0) * volumeFraction;

          acc[materialKey].volume += layerVolume;
          acc[materialKey].elements.push({
            globalId: element.globalId,
            name: element.name,
            volume: layerVolume,
            thickness: layer.thickness
          });
        });

        return acc;
      }, {});


      // Create/update materials
      const materialOps = Object.values(materialsByName).map((material: any) => ({
        updateOne: {
          filter: {
            name: material.name,
            projectId: new mongoose.Types.ObjectId(projectId)
          },
          update: {
            $set: {
              volume: material.volume,
              updatedAt: new Date()
            },
            $setOnInsert: {
              name: material.name,
              projectId: new mongoose.Types.ObjectId(projectId)
            }
          },
          upsert: true
        }
      }));

      // Execute material operations
      let materialResults = { upsertedCount: 0, modifiedCount: 0 };
      if (materialOps.length > 0) {
        materialResults = await Material.bulkWrite(materialOps, {
          session,
          ordered: false
        });
      }

      // Get all materials including newly created ones
      const allMaterials = await Material.find({
        projectId: new mongoose.Types.ObjectId(projectId)
      })
        .select('_id name')
        .lean()
        .session(session);

      // Create material lookup map
      const materialMap = new Map(
        allMaterials.map(m => [m.name.trim().toLowerCase(), m._id])
      );

      // Prepare element operations
      const elementOps = elements.map(element => {
        const totalThickness = element.materialLayers?.layers.reduce(
          (sum, layer) => sum + (layer.thickness || 0),
          0
        ) || 0;

        return {
          updateOne: {
            filter: {
              guid: element.globalId,
              projectId: new mongoose.Types.ObjectId(projectId)
            },
            update: {
              $set: {
                name: element.name,
                type: element.type,
                volume: element.netVolume || 0,
                materials: element.materialLayers?.layers.map(layer => {
                  const volumeFraction = totalThickness > 0 ? (layer.thickness || 0) / totalThickness : 0;
                  const materialId = materialMap.get(layer.materialName.trim().toLowerCase());

                  if (!materialId) {
                    return null;
                  }

                  return {
                    material: new mongoose.Types.ObjectId(materialId),
                    volume: (element.netVolume || 0) * volumeFraction,
                    density: 0,
                    mass: 0,
                    fraction: volumeFraction,
                    thickness: layer.thickness,
                    indicators: {
                      gwp: 0,
                      ubp: 0,
                      penre: 0
                    }
                  };
                }).filter(m => m !== null) || [],
                indicators: {
                  gwp: 0,
                  ubp: 0,
                  penre: 0
                },
                updatedAt: new Date()
              },
              $setOnInsert: {
                projectId: new mongoose.Types.ObjectId(projectId),
                uploadId: new mongoose.Types.ObjectId(uploadId)
              }
            },
            upsert: true
          }
        };
      });

      // Execute element operations
      let elementResults = { upsertedCount: 0, modifiedCount: 0 };
      if (elementOps.length > 0) {
        elementResults = await Element.bulkWrite(elementOps, {
          session,
          ordered: false
        });
      }

      return {
        materialResults,
        elementResults,
        materialCount: materialOps.length,
        elementCount: elementOps.length
      };
    } catch (error) {
      throw error;
    }
  }
}
