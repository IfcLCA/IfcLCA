import mongoose from "mongoose";
import { Material, KBOBMaterial, Element, Project } from "@/models";
import { logger } from "@/lib/logger";
import type { ClientSession, Types } from "mongoose";

// Update interfaces with proper types
interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

interface IKBOBMaterial {
  _id: Types.ObjectId;
  Name: string;
  Category?: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "kg/unit"?: number;
  "min density"?: number;
  "max density"?: number;
  KBOB_ID: number;
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

// Add type for populated Material document
interface MaterialWithKBOB {
  _id: Types.ObjectId;
  name: string;
  projectId: Types.ObjectId;
  density?: number;
  kbobMatchId?: IKBOBMaterial;
}

// Add type for populated Element document
interface ElementWithProject {
  _id: Types.ObjectId;
  projectId: {
    _id: Types.ObjectId;
    name: string;
  };
  materials: Array<{
    material: Types.ObjectId;
    volume: number;
  }>;
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
    session?: ClientSession,
    projectId?: string
  ): Promise<number> {
    const referenceMaterial = await Material.findById(materialId)
      .select("name projectId")
      .session(session)
      .lean();

    if (!referenceMaterial?.name || !referenceMaterial.projectId) {
      console.error(
        "❌ [Material Service] Material not found or missing project:",
        materialId
      );
      throw new Error(
        `Material ${materialId} not found, has no name, or no project`
      );
    }

    // Use a transaction if one wasn't provided
    const useSession = session || (await mongoose.startSession());
    if (!session) {
      useSession.startTransaction();
    }

    try {
      // Update only materials with this name in the same project
      const updateResult = await Material.updateMany(
        {
          name: referenceMaterial.name,
          projectId: projectId || referenceMaterial.projectId,
        },
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

      // Recalculate affected elements
      const recalcResult = await this.recalculateElementsForMaterials(
        updatedMaterials.map((m) => m._id),
        useSession
      );

      if (!session) {
        await useSession.commitTransaction();
      }

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
    session: ClientSession | null = null
  ): Promise<number> {
    const BATCH_SIZE = 500;
    let totalModified = 0;

    try {
      // Get all materials with their KBOB matches in one query
      const materials = await Material.find({ _id: { $in: materialIds } })
        .select("_id name kbobMatchId density")
        .populate<{ kbobMatchId: IKBOBMaterial }>("kbobMatchId")
        .session(session)
        .lean();

      if (!materials.length) {
        return 0;
      }

      const materialMap = new Map(materials.map((m) => [m._id.toString(), m]));

      // Count total elements to process
      const totalElements = await Element.countDocuments({
        "materials.material": { $in: materialIds },
      }).session(session);

      // Process in batches
      for (let skip = 0; skip < totalElements; skip += BATCH_SIZE) {
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
        }
      }

      return totalModified;
    } catch (error) {
      logger.error("Error in element recalculation:", error);
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
  static async getProjectsWithMaterials(userId: string) {
    // Get all projects for the user
    const projects = await Project.find({ userId }).select("_id name").lean();

    // Get all materials for these projects
    const projectIds = projects.map((p) => p._id);
    const materials = await Material.find({
      projectId: { $in: projectIds },
    })
      .select("name projectId")
      .lean();

    // Group materials by project
    const materialsByProject = materials.reduce((acc, material) => {
      const projectId = material.projectId.toString();
      if (!acc[projectId]) {
        acc[projectId] = [];
      }
      acc[projectId].push(material);
      return acc;
    }, {} as Record<string, any[]>);

    // Combine project info with their materials
    return projects.map((project) => ({
      id: project._id.toString(),
      name: project.name,
      materialIds: (materialsByProject[project._id.toString()] || []).map((m) =>
        m._id.toString()
      ),
    }));
  }

  /**
   * Finds existing material match across all projects
   */
  static async findExistingMaterial(
    materialName: string
  ): Promise<Material | null> {
    const cleanedName = materialName.trim().toLowerCase();

    try {
      // Try exact match first
      const exactMatch = await Material.findOne({
        name: materialName,
        kbobMatchId: { $exists: true },
      })
        .populate("kbobMatchId")
        .lean();

      if (exactMatch) {
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
        return caseInsensitiveMatch;
      }

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
   * Processes materials after Ifc upload with validation
   */
  static async processMaterials(
    projectId: string,
    elements: Array<{
      globalId: string;
      type: string;
      name: string;
      netVolume?: number | { net: number; gross: number };
      properties?: {
        loadBearing?: boolean;
        isExternal?: boolean;
      };
      materialLayers?: {
        layers: Array<{
          materialName: string;
          volume: number;
        }>;
      };
    }>,
    uploadId: string,
    session: mongoose.ClientSession
  ) {
    try {
      console.debug("🏗️ Material service processing:", {
        sampleElement: elements[0],
        properties: elements[0].properties,
      });

      // Create elements with properties
      const elementOps = elements.map((element) => {
        // Extract volume from netVolume object or use direct value
        const volume =
          typeof element.netVolume === "object"
            ? element.netVolume.net
            : element.netVolume || 0;

        const updateOp = {
          updateOne: {
            filter: {
              guid: element.globalId,
              projectId: new mongoose.Types.ObjectId(projectId),
            },
            update: {
              $set: {
                name: element.name,
                type: element.type,
                volume: volume, // Use extracted volume
                loadBearing: element.properties?.loadBearing || false,
                isExternal: element.properties?.isExternal || false,
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

        console.debug("📝 Element update operation:", {
          filter: updateOp.updateOne.filter,
          update: updateOp.updateOne.update,
        });

        return updateOp;
      });

      // Execute in batches
      const BATCH_SIZE = 1000;
      for (let i = 0; i < elementOps.length; i += BATCH_SIZE) {
        const batch = elementOps.slice(i, i + BATCH_SIZE);
        const result = await Element.bulkWrite(batch, {
          session,
          ordered: false,
        });
        console.debug("✅ Batch result:", result);
      }

      return {
        success: true,
        elementCount: elementOps.length,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates or updates a material with an existing match
   */
  static async createMaterialWithMatch(
    projectId: string,
    materialName: string,
    kbobMatchId: Types.ObjectId,
    density?: number
  ): Promise<Material> {
    try {
      // Check if material already exists in the project
      const existingMaterial = await Material.findOne({
        name: materialName,
        projectId,
      });

      // Fetch KBOB material data
      const kbobMaterial = await KBOBMaterial.findById<IKBOBMaterial>(
        kbobMatchId
      ).lean();
      if (!kbobMaterial) {
        throw new Error(`KBOB material not found for id: ${kbobMatchId}`);
      }

      // Calculate density if not provided
      const finalDensity = density || this.calculateDensity(kbobMaterial);
      if (!finalDensity) {
        throw new Error(
          `Could not determine density for material: ${materialName}`
        );
      }

      // Calculate LCA indicators
      const indicators = this.calculateIndicators(
        1,
        finalDensity,
        kbobMaterial
      );
      if (!indicators) {
        throw new Error(
          `Could not calculate indicators for material: ${materialName}`
        );
      }

      if (existingMaterial) {
        // Update existing material
        existingMaterial.kbobMatchId = kbobMatchId;
        existingMaterial.density = finalDensity;
        existingMaterial.gwp = indicators.gwp;
        existingMaterial.ubp = indicators.ubp;
        existingMaterial.penre = indicators.penre;
        await existingMaterial.save();
        return existingMaterial;
      } else {
        // Create new material
        const newMaterial = await Material.create({
          name: materialName,
          projectId,
          kbobMatchId,
          density: finalDensity,
          gwp: indicators.gwp,
          ubp: indicators.ubp,
          penre: indicators.penre,
        });
        return newMaterial;
      }
    } catch (error) {
      console.error(
        "❌ [Material Service] Error in createMaterialWithMatch:",
        error
      );
      throw error;
    }
  }

  /**
   * Update project emissions
   */
  static async updateProjectEmissions(
    projectId: string | Types.ObjectId,
    session?: ClientSession
  ) {
    try {
      const totals = await this.calculateProjectTotals(projectId.toString());

      logger.debug("Attempting to update project emissions:", {
        projectId: projectId.toString(),
        totals,
      });

      const projectObjectId =
        typeof projectId === "string"
          ? new mongoose.Types.ObjectId(projectId)
          : projectId;

      // First verify the project exists
      const project = await Project.findById(projectObjectId).session(session);

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Update with more detailed error handling
      try {
        // Use updateOne instead of findByIdAndUpdate for better performance
        const result = await Project.updateOne(
          { _id: projectObjectId },
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
          {
            session,
            runValidators: true,
          }
        );

        if (!result.modifiedCount) {
          throw new Error(`Project update failed: ${projectId}`);
        }

        logger.debug("Successfully updated project emissions:", {
          projectId: projectId.toString(),
          totals,
          result: {
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount,
          },
        });

        return totals;
      } catch (updateError) {
        logger.error("Project update operation failed:", {
          error:
            updateError instanceof Error
              ? {
                  message: updateError.message,
                  stack: updateError.stack,
                  name: updateError.name,
                }
              : updateError,
          projectId: projectId.toString(),
          totals,
        });
        throw updateError;
      }
    } catch (error) {
      logger.error("Error in updateProjectEmissions:", {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
        projectId: projectId.toString(),
      });
      throw error;
    }
  }

  /**
   * Update elements for material match and recalculate project emissions
   */
  static async updateElementsForMaterialMatch(
    materialId: string,
    kbobMatchId: string,
    density: number,
    session?: ClientSession
  ) {
    const useSession = session || (await mongoose.startSession());
    if (!session) {
      useSession.startTransaction();
    }

    try {
      const processedCount = await this.recalculateElementsForMaterials(
        [new Types.ObjectId(materialId)],
        useSession
      );

      // Get unique project IDs for this material
      const affectedProjects = await Element.distinct("projectId", {
        "materials.material": new Types.ObjectId(materialId),
      }).session(useSession);

      // Update emissions for all affected projects
      await Promise.all(
        affectedProjects.map((projectId) =>
          this.updateProjectEmissions(projectId, useSession)
        )
      );

      if (!session) {
        await useSession.commitTransaction();
      }

      return processedCount;
    } catch (error) {
      if (!session) {
        await useSession.abortTransaction();
      }
      logger.error("Error in material match update:", error);
      throw error;
    } finally {
      if (!session) {
        await useSession.endSession();
      }
    }
  }

  /**
   * Calculate total project emissions
   */
  static async calculateProjectTotals(projectId: string): Promise<{
    totalGWP: number;
    totalUBP: number;
    totalPENRE: number;
  }> {
    try {
      const elements = await Element.find({
        projectId: new mongoose.Types.ObjectId(projectId),
      })
        .populate({
          path: "materials.material",
          select: "density kbobMatchId",
          populate: {
            path: "kbobMatchId",
            select: "GWP UBP PENRE",
          },
        })
        .lean();

      const totals = elements.reduce(
        (acc, element) => {
          const elementTotals = element.materials.reduce(
            (matAcc, material) => {
              const volume = material.volume || 0;
              const density = material.material?.density || 0;
              const kbobMatch = material.material?.kbobMatchId;

              // Calculate mass-based emissions
              const mass = volume * density;
              return {
                gwp: matAcc.gwp + mass * (kbobMatch?.GWP || 0),
                ubp: matAcc.ubp + mass * (kbobMatch?.UBP || 0),
                penre: matAcc.penre + mass * (kbobMatch?.PENRE || 0),
              };
            },
            { gwp: 0, ubp: 0, penre: 0 }
          );

          return {
            totalGWP: acc.totalGWP + elementTotals.gwp,
            totalUBP: acc.totalUBP + elementTotals.ubp,
            totalPENRE: acc.totalPENRE + elementTotals.penre,
          };
        },
        { totalGWP: 0, totalUBP: 0, totalPENRE: 0 }
      );

      logger.debug("Project totals calculated:", {
        projectId,
        totals,
        elementCount: elements.length,
      });

      return totals;
    } catch (error) {
      logger.error("Error calculating project totals:", {
        error,
        projectId,
      });
      return { totalGWP: 0, totalUBP: 0, totalPENRE: 0 };
    }
  }
}
