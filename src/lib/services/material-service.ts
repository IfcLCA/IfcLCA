import mongoose from "mongoose";
import { Material, KBOBMaterial, Element, Project } from "@/models";
import { logger } from "@/lib/logger";
import { ClientSession, Types } from "mongoose";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";
import type { IKBOBMaterial, IMaterial } from "@/types/material";

// Update interfaces with proper types
interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
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
  // Cache configuration
  private static materialCache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Utility methods
  /**
   * Escapes regex special characters to prevent regex injection
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static async withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
    existingSession?: ClientSession
  ): Promise<T> {
    const session = existingSession || (await mongoose.startSession());
    if (!existingSession) {
      session.startTransaction();
    }

    try {
      const result = await callback(session);
      if (!existingSession) {
        await session.commitTransaction();
      }
      return result;
    } catch (error) {
      if (!existingSession) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (!existingSession) {
        await session.endSession();
      }
    }
  }

  private static logError(
    methodName: string,
    error: unknown,
    context?: Record<string, unknown>
  ) {
    const errorDetails =
      error instanceof Error
        ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
        : error;

    logger.error(`Error in ${methodName}:`, {
      error: errorDetails,
      ...context,
    });
  }

  private static calculateDensityFromKBOB(kbobMaterial: IKBOBMaterial): number {
    // First try the new API density field
    if (kbobMaterial.density !== null && kbobMaterial.density !== undefined) {
      if (typeof kbobMaterial.density === "number" && !isNaN(kbobMaterial.density)) {
        return kbobMaterial.density;
      }
      if (typeof kbobMaterial.density === "string" && kbobMaterial.density !== "" && kbobMaterial.density !== "-") {
        const parsed = parseFloat(kbobMaterial.density);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    
    // Use kg/unit if available (handle both number and string)
    const kgPerUnit = kbobMaterial["kg/unit"];
    if (typeof kgPerUnit === "number" && !isNaN(kgPerUnit)) {
      return kgPerUnit;
    }
    if (typeof kgPerUnit === "string") {
      const parsed = parseFloat(kgPerUnit);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    if (
      typeof kbobMaterial["min density"] === "number" &&
      typeof kbobMaterial["max density"] === "number" &&
      !isNaN(kbobMaterial["min density"]) &&
      !isNaN(kbobMaterial["max density"])
    ) {
      return (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }

    return 0;
  }

  // Core KBOB material operations
  static async setKBOBMatch(
    materialId: Types.ObjectId,
    kbobMatchId: Types.ObjectId,
    density?: number,
    session?: ClientSession,
    projectId?: string
  ): Promise<number> {
    return this.withTransaction(async (useSession) => {
      const referenceMaterial = await Material.findById(materialId)
        .select("name projectId")
        .session(useSession)
        .lean() as { name: string; projectId: Types.ObjectId } | null;

      if (!referenceMaterial?.name || !referenceMaterial.projectId) {
        console.error(
          "❌ [Material Service] Material not found or missing project:",
          materialId
        );
        throw new Error(
          `Material ${materialId} not found, has no name, or no project`
        );
      }

      // Update materials
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

      // After updating materials, we recalculate elements and emissions
      await this.updateElementsForMaterialMatch(
        materialId.toString(),
        kbobMatchId.toString(),
        density || 0,
        useSession
      );

      return updateResult.modifiedCount;
    }, session);
  }

  static async findBestKBOBMatch(
    materialName: string
  ): Promise<{ kbobMaterial: IKBOBMaterial; score: number } | null> {
    const cleanedName = materialName.trim();

    try {
      // Try exact match first
      const exactMatch = await KBOBMaterial.findOne({
        Name: cleanedName,
      }).lean() as IKBOBMaterial | null;

      if (exactMatch) {
        return { kbobMaterial: exactMatch, score: 1.0 };
      }

      // Try case-insensitive match with escaped regex to prevent injection
      const caseInsensitiveMatch = await KBOBMaterial.findOne({
        Name: { $regex: `^${this.escapeRegex(cleanedName)}$`, $options: "i" },
      }).lean() as IKBOBMaterial | null;

      if (caseInsensitiveMatch) {
        return { kbobMaterial: caseInsensitiveMatch, score: 0.99 };
      }

      return null;
    } catch (error) {
      console.error("❌ [Material Service] Error in findBestKBOBMatch:", error);
      throw error;
    }
  }

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
          .populate("kbobMatchId", "Name GWP UBP PENRE gwpTotal ubp21Total primaryEnergyNonRenewableTotal density")
          .lean(),
        KBOBMaterial.findById(kbobObjectId).lean(),
        Element.find({ "materials.material": { $in: objectIds } })
          .populate("projectId", "name")
          .lean(),
      ]) as unknown as [
          Array<{ _id: Types.ObjectId; name: string; kbobMatchId: IKBOBMaterial | null; density?: number }>,
          IKBOBMaterial | null,
          Array<{ _id: Types.ObjectId; materials: Array<{ material: Types.ObjectId }>; projectId: { _id: Types.ObjectId; name: string } }>
        ];

      if (!newKBOBMaterial) {
        throw new Error("KBOB material not found");
      }

      // Calculate affected elements per material
      const elementCounts = new Map<string, number>();
      const projectMap = new Map<string, Set<string>>();

      elements.forEach((element) => {
        const projectName = element.projectId?.name;
        if (!projectName) return;

        element.materials.forEach((mat: { material: Types.ObjectId }) => {
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
        newDensity: Number(
          density || this.calculateDensityFromKBOB(newKBOBMaterial)
        ),
        affectedElements: elementCounts.get(material._id.toString()) || 0,
        projects: Array.from(
          projectMap.get(material._id.toString()) || new Set<string>()
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
   * Calculates density from KBOB material with validation
   */
  static calculateDensity(kbobMaterial: IKBOBMaterial): number | null {
    if (!kbobMaterial) return null;

    // Use kg/unit if available (handle both number and string)
    const kgPerUnit = kbobMaterial["kg/unit"];
    if (typeof kgPerUnit === "number" && !isNaN(kgPerUnit)) {
      return kgPerUnit;
    }
    if (typeof kgPerUnit === "string") {
      const parsed = parseFloat(kgPerUnit);
      if (!isNaN(parsed)) {
        return parsed;
      }
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
   * Calculates LCA indicators
   */
  static calculateIndicators(
    volume: number,
    density: number | undefined,
    kbobMaterial: IKBOBMaterial | null
  ): ILCAIndicators | undefined {
    if (!kbobMaterial || !density || density <= 0 || !volume || isNaN(volume)) {
      return undefined;
    }

    // Check if material has ANY valid environmental indicators (legacy or new format)
    const hasLegacyIndicators =
      typeof kbobMaterial.GWP === "number" ||
      typeof kbobMaterial.UBP === "number" ||
      typeof kbobMaterial.PENRE === "number";
    
    const hasNewIndicators =
      typeof kbobMaterial.gwpTotal === "number" ||
      typeof kbobMaterial.ubp21Total === "number" ||
      typeof kbobMaterial.primaryEnergyNonRenewableTotal === "number";
    
    // If material has no indicators at all, return undefined
    if (!hasLegacyIndicators && !hasNewIndicators) {
      return undefined;
    }

    // Use helper functions to get values (with fallback logic)
    const gwp = getGWP(kbobMaterial);
    const ubp = getUBP(kbobMaterial);
    const penre = getPENRE(kbobMaterial);

    const mass = volume * density;
    return {
      gwp: mass * gwp,
      ubp: mass * ubp,
      penre: mass * penre,
    };
  }

  /**
   * Gets projects with materials using efficient queries
   */
  static async getProjectsWithMaterials(userId: string) {
    // Get all projects for the user
    const projects = await Project.find({ userId }).select("_id name").lean() as unknown as Array<{ _id: Types.ObjectId; name: string }>;

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
    materialName: string,
    userId: string
  ): Promise<(mongoose.Document & IMaterial) | null> {
    const cleanedName = materialName.trim().toLowerCase();

    try {
      // Get projects belonging to the user
      const userProjects = await Project.find({ userId })
        .select("_id")
        .lean() as Array<{ _id: Types.ObjectId }>;
      const projectIds = userProjects.map((p) => p._id);

      // Try exact match first within user's projects
      const exactMatch = await Material.findOne({
        name: materialName,
        projectId: { $in: projectIds },
        kbobMatchId: { $exists: true },
      })
        .populate("kbobMatchId", "Name GWP UBP PENRE gwpTotal ubp21Total primaryEnergyNonRenewableTotal density")
        .lean() as (mongoose.Document & IMaterial) | null;

      if (exactMatch) {
        return exactMatch;
      }

      // Try case-insensitive match with escaped regex to prevent injection
      const caseInsensitiveMatch = await Material.findOne({
        name: { $regex: `^${this.escapeRegex(cleanedName)}$`, $options: "i" },
        projectId: { $in: projectIds },
        kbobMatchId: { $exists: true },
      })
        .populate("kbobMatchId", "Name GWP UBP PENRE gwpTotal ubp21Total primaryEnergyNonRenewableTotal density")
        .lean() as (mongoose.Document & IMaterial) | null;

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
      grossVolume?: number | { net: number; gross: number };
      materialLayers?: {
        layers: Array<{
          materialName: string;
          thickness: number;
        }>;
        layerSetName?: string;
      };
      properties?: {
        loadBearing?: boolean;
        isExternal?: boolean;
      };
    }>,
    uploadId: string,
    session: mongoose.ClientSession
  ) {
    try {
      const materialVolumes = new Map<string, number>();
      const elementOps = [];

      // First pass: Calculate total volumes per material
      for (const element of elements) {
        const elementVolume = this.calculateElementVolume(element);

        if (element.materialLayers?.layers) {
          const totalThickness = element.materialLayers.layers.reduce(
            (sum, layer) => sum + (layer.thickness || 0),
            0
          );

          for (const layer of element.materialLayers.layers) {
            if (layer.materialName) {
              const volumeFraction =
                totalThickness > 0
                  ? (layer.thickness || 0) / totalThickness
                  : 1 / element.materialLayers.layers.length;

              const materialVolume = elementVolume * volumeFraction;
              materialVolumes.set(
                layer.materialName,
                (materialVolumes.get(layer.materialName) || 0) + materialVolume
              );
            }
          }
        }

        // Create element operation
        elementOps.push({
          updateOne: {
            filter: { guid: element.globalId, projectId },
            update: {
              $set: {
                name: element.name,
                type: element.type,
                volume: elementVolume,
                loadBearing: element.properties?.loadBearing || false,
                isExternal: element.properties?.isExternal || false,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                projectId,
                guid: element.globalId,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        });
      }

      // Second pass: Update materials with accumulated volumes
      const materialOps = Array.from(materialVolumes.entries()).map(
        ([name, volume]) => ({
          updateOne: {
            filter: { name, projectId },
            update: {
              $set: {
                volume,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                name,
                projectId,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        })
      );

      // Execute operations
      const [elementResult, materialResult] = await Promise.all([
        Element.bulkWrite(elementOps, { session }),
        Material.bulkWrite(materialOps, { session }),
      ]);

      logger.debug("Processing results", {
        elements: {
          matched: elementResult.matchedCount,
          modified: elementResult.modifiedCount,
          upserted: elementResult.upsertedCount,
        },
        materials: {
          matched: materialResult.matchedCount,
          modified: materialResult.modifiedCount,
          upserted: materialResult.upsertedCount,
        },
      });

      return {
        success: true,
        elementCount: elementResult.modifiedCount + elementResult.upsertedCount,
        materialCount:
          materialResult.modifiedCount + materialResult.upsertedCount,
      };
    } catch (error) {
      logger.error("Error in material processing", { error });
      throw error;
    }
  }

  private static calculateElementVolume(element: any): number {
    if (typeof element.netVolume === "object") {
      return element.netVolume.net || 0;
    }
    if (typeof element.netVolume === "number") {
      return element.netVolume;
    }
    if (typeof element.grossVolume === "object") {
      return element.grossVolume.net || 0;
    }
    if (typeof element.grossVolume === "number") {
      return element.grossVolume;
    }
    return 0;
  }

  /**
   * Creates or updates a material with an existing match
   */
  static async createMaterialWithMatch(
    projectId: string,
    materialName: string,
    kbobMatchId: Types.ObjectId,
    density?: number
  ): Promise<typeof Material | null> {
    try {
      // Check if material already exists in the project
      const existingMaterial = await Material.findOne({
        name: materialName,
        projectId,
      });

      // Fetch KBOB material data
      const kbobMaterial = await KBOBMaterial.findById(
        kbobMatchId
      ).lean() as IKBOBMaterial | null;
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
  ): Promise<{ totalGWP: number; totalUBP: number; totalPENRE: number }> {
    try {
      const projectObjectId = new mongoose.Types.ObjectId(projectId.toString());

      // Calculate emissions from elements
      const elements = await Element.find({
        projectId: projectObjectId,
      })
        .select("materials.volume materials.material")
        .populate({
          path: "materials.material",
          select: "density kbobMatchId",
          populate: {
            path: "kbobMatchId",
            select: "GWP UBP PENRE",
          },
        })
        .session(session || null)
        .lean();

      const totals = elements.reduce(
        (acc, element) => {
          const elementTotals = element.materials.reduce(
            (matAcc: { gwp: number; ubp: number; penre: number }, material: { volume?: number; material?: { density?: number; kbobMatchId?: Types.ObjectId | any } }) => {
              const volume = material.volume || 0;
              const density = material.material?.density || 0;
              // When populated, kbobMatchId contains the KBOB material object
              const kbobMatch = material.material?.kbobMatchId as any;
              const mass = volume * density;

              return {
                gwp: matAcc.gwp + mass * getGWP(kbobMatch),
                ubp: matAcc.ubp + mass * getUBP(kbobMatch),
                penre: matAcc.penre + mass * getPENRE(kbobMatch),
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

      // PERSIST TO PROJECT (THIS WAS MISSING!)
      await Project.updateOne(
        { _id: projectObjectId },
        {
          $set: {
            "emissions.gwp": totals.totalGWP,
            "emissions.ubp": totals.totalUBP,
            "emissions.penre": totals.totalPENRE,
            "emissions.lastCalculated": new Date(),
          },
        },
        { session: session || undefined }
      );

      logger.debug("Updated project emissions", {
        projectId: projectId.toString(),
        totals,
        elementCount: elements.length,
      });

      return totals;
    } catch (error) {
      logger.error("Error updating project emissions", { error, projectId });
      throw error; // Don't hide errors
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
    return this.withTransaction(async (useSession) => {
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

      return processedCount;
    }, session);
  }

  /**
   * Recalculates elements for given materials with efficient batching
   */
  static async recalculateElementsForMaterials(
    materialIds: Types.ObjectId[],
    session: ClientSession | null = null
  ): Promise<number> {
    try {
      // Get all materials with their KBOB matches
      // Note: After populate(), kbobMatchId contains the populated KBOB material object
      const materials = await Material.find({ _id: { $in: materialIds } })
        .select("_id density kbobMatchId name")
        .populate("kbobMatchId", "GWP UBP PENRE gwpTotal ubp21Total primaryEnergyNonRenewableTotal")
        .session(session)
        .lean();

      // Create a map for faster lookups
      const materialMap = new Map(materials.map((m: any) => [m._id.toString(), m]));

      // Update elements with new calculations
      const bulkOps = await Element.aggregate([
        {
          $match: { "materials.material": { $in: materialIds } },
        },
        {
          $addFields: {
            materials: {
              $map: {
                input: "$materials",
                as: "mat",
                in: {
                  $cond: {
                    if: { $in: ["$$mat.material", materialIds] },
                    then: {
                      $let: {
                        vars: {
                          material: {
                            $arrayElemAt: [
                              materials,
                              {
                                $indexOfArray: [
                                  materials.map((m) => m._id),
                                  "$$mat.material",
                                ],
                              },
                            ],
                          },
                        },
                        in: {
                          material: "$$mat.material",
                          volume: "$$mat.volume",
                          density: "$$material.density",
                          mass: {
                            $multiply: ["$$mat.volume", "$$material.density"],
                          },
                          fraction: "$$mat.fraction",
                          indicators: {
                            gwp: {
                              $multiply: [
                                {
                                  $multiply: [
                                    "$$mat.volume",
                                    "$$material.density",
                                  ],
                                },
                                {
                                  $ifNull: [
                                    {
                                      $ifNull: ["$$material.kbobMatchId.gwpTotal", "$$material.kbobMatchId.GWP"],
                                    },
                                    0,
                                  ],
                                },
                              ],
                            },
                            ubp: {
                              $multiply: [
                                {
                                  $multiply: [
                                    "$$mat.volume",
                                    "$$material.density",
                                  ],
                                },
                                {
                                  $ifNull: [
                                    {
                                      $ifNull: ["$$material.kbobMatchId.ubp21Total", "$$material.kbobMatchId.UBP"],
                                    },
                                    0,
                                  ],
                                },
                              ],
                            },
                            penre: {
                              $multiply: [
                                {
                                  $multiply: [
                                    "$$mat.volume",
                                    "$$material.density",
                                  ],
                                },
                                {
                                  $ifNull: [
                                    {
                                      $ifNull: [
                                        "$$material.kbobMatchId.primaryEnergyNonRenewableTotal",
                                        "$$material.kbobMatchId.PENRE",
                                      ],
                                    },
                                    0,
                                  ],
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                    else: "$$mat",
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            totalIndicators: {
              $reduce: {
                input: "$materials",
                initialValue: { gwp: 0, ubp: 0, penre: 0 },
                in: {
                  gwp: {
                    $add: [
                      "$$value.gwp",
                      { $ifNull: ["$$this.indicators.gwp", 0] },
                    ],
                  },
                  ubp: {
                    $add: [
                      "$$value.ubp",
                      { $ifNull: ["$$this.indicators.ubp", 0] },
                    ],
                  },
                  penre: {
                    $add: [
                      "$$value.penre",
                      { $ifNull: ["$$this.indicators.penre", 0] },
                    ],
                  },
                },
              },
            },
          },
        },
      ]).session(session);

      // Execute bulk updates
      let modifiedCount = 0;
      if (bulkOps.length) {
        const result = await Element.bulkWrite(
          bulkOps.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  materials: doc.materials,
                  totalIndicators: doc.totalIndicators,
                },
              },
            },
          })),
          { session: session || undefined }
        );
        modifiedCount = result.modifiedCount;
      }

      return modifiedCount;
    } catch (error) {
      this.logError("recalculateElementsForMaterials", error, { materialIds });
      throw error;
    }
  }
}
