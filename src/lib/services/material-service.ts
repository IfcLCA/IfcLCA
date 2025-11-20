import mongoose from "mongoose";
import { Material, KBOBMaterial, Element, Project } from "@/models";
import { logger } from "@/lib/logger";
import { ClientSession, Types } from "mongoose";

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

export class MaterialService {
  // Cache configuration
  private static materialCache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Utility methods
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
    if (
      typeof kbobMaterial["kg/unit"] === "number" &&
      !isNaN(kbobMaterial["kg/unit"])
    ) {
      return kbobMaterial["kg/unit"];
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

  static async getMatchPreview(
    materialIds: string[],
    matchId: string,
    dataSource: 'kbob' | 'okobaudat' = 'kbob',
    density?: number
  ): Promise<IMaterialPreview> {
    if (dataSource === 'okobaudat') {
      return this.getOkobaudatMatchPreview(materialIds, matchId, density);
    }
    return this.getKBOBMatchPreview(materialIds, matchId, density);
  }

  static async getOkobaudatMatchPreview(
    materialIds: string[],
    okobaudatId: string,
    density?: number
  ): Promise<IMaterialPreview> {
    const { OkobaudatService } = await import('./okobaudat-service');
    const { DensityService } = await import('./density-service');
    
    const cacheKey = `preview-okobaudat-${materialIds.join("-")}-${okobaudatId}-${density}`;
    const cached = MaterialService.materialCache.get(cacheKey);
    if (cached?.timestamp > Date.now() - MaterialService.cacheTimeout) {
      return cached.data;
    }

    try {
      const objectIds = materialIds.map((id) => new mongoose.Types.ObjectId(id));
      
      const [materials, okobaudatMaterial, elements] = await Promise.all([
        Material.find({ _id: { $in: objectIds } }).lean(),
        OkobaudatService.getMaterialDetails(okobaudatId),
        Element.find({ "materials.material": { $in: objectIds } })
          .populate<{ projectId: { _id: Types.ObjectId; name: string } }>("projectId", "name")
          .lean(),
      ]);

      if (!okobaudatMaterial) {
        throw new Error("Ökobaudat material not found");
      }

      // Calculate or get density
      let finalDensity = density || okobaudatMaterial.density;
      if (!finalDensity && materials.length > 0) {
        const fallback = await DensityService.getDensityFallback(
          materials[0].name,
          materials[0].category || okobaudatMaterial.category
        );
        if (fallback) {
          finalDensity = fallback.typical;
        }
      }

      // Calculate affected elements per material
      const elementCounts = new Map<string, number>();
      const projectMap = new Map<string, Set<string>>();

      elements.forEach((element) => {
        const projectName = element.projectId?.name;
        if (!projectName) return;

        element.materials.forEach((mat) => {
          const materialId = mat.material.toString();
          elementCounts.set(materialId, (elementCounts.get(materialId) || 0) + 1);

          if (!projectMap.has(materialId)) {
            projectMap.set(materialId, new Set());
          }
          projectMap.get(materialId)?.add(projectName);
        });
      });

      const changes: IMaterialChange[] = materials.map((material) => ({
        materialId: material._id.toString(),
        materialName: material.name,
        oldKbobMatch: material.kbobMatchId ? "Previous KBOB match" : material.okobaudatData?.name,
        newKbobMatch: okobaudatMaterial.name,
        oldDensity: material.density,
        newDensity: Number(finalDensity || 0),
        affectedElements: elementCounts.get(material._id.toString()) || 0,
        projects: Array.from(projectMap.get(material._id.toString()) || new Set<string>()).sort(),
        dataSource: 'okobaudat',
      }));

      const preview = { changes };
      MaterialService.materialCache.set(cacheKey, {
        data: preview,
        timestamp: Date.now(),
      });

      return preview;
    } catch (error) {
      console.error("❌ [Material Service] Error in getOkobaudatMatchPreview:", error);
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
          .populate<{ kbobMatchId: IKBOBMaterial }>("kbobMatchId")
          .lean(),
        KBOBMaterial.findById<IKBOBMaterial>(kbobObjectId).lean(),
        Element.find({ "materials.material": { $in: objectIds } })
          .populate<{ projectId: { _id: Types.ObjectId; name: string } }>(
            "projectId",
            "name"
          )
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
   * Finds best material match from specified data source
   */
  static async findBestMatch(
    materialName: string,
    dataSource: 'kbob' | 'okobaudat' = 'kbob'
  ): Promise<{ material: any; score: number; source: string } | null> {
    if (dataSource === 'okobaudat') {
      const { OkobaudatMatcher } = await import('./okobaudat-matcher');
      const matches = await OkobaudatMatcher.findBestMatches(materialName, {
        limit: 1,
        threshold: 0.3,
        compliance: 'A2',
      });
      
      if (matches.length > 0) {
        return {
          material: matches[0].material,
          score: matches[0].score,
          source: 'okobaudat',
        };
      }
      return null;
    }
    
    const kbobMatch = await this.findBestKBOBMatch(materialName);
    if (kbobMatch) {
      return {
        material: kbobMatch.kbobMaterial,
        score: kbobMatch.score,
        source: 'kbob',
      };
    }
    return null;
  }

  /**
   * Finds KBOB material match
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
    materialName: string,
    userId: string
  ): Promise<(mongoose.Document & IMaterial) | null> {
    const cleanedName = materialName.trim().toLowerCase();

    try {
      // Get projects belonging to the user
      const userProjects = await Project.find({ userId })
        .select("_id")
        .lean();
      const projectIds = userProjects.map((p) => p._id);

      // Try exact match first within user's projects
      const exactMatch = await Material.findOne({
        name: materialName,
        projectId: { $in: projectIds },
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
        projectId: { $in: projectIds },
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
      const elements = await Element.find({
        projectId: new mongoose.Types.ObjectId(projectId.toString()),
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
        .lean();

      logger.debug("Project elements for emission calculation:", {
        projectId: projectId.toString(),
        elementCount: elements.length,
        sampleElement: elements[0]?.materials.map((m) => ({
          volume: m.volume,
          density: m.material?.density,
          gwp: m.material?.kbobMatchId?.GWP,
        })),
      });

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

  /**
   * Calculates emissions for a project using aggregation
   */
  private static async calculateProjectEmissions(
    projectId: Types.ObjectId | string,
    session?: ClientSession
  ) {
    const [totals] = await Element.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId.toString()),
        },
      },
      {
        $group: {
          _id: null,
          gwp: { $sum: "$totalIndicators.gwp" },
          ubp: { $sum: "$totalIndicators.ubp" },
          penre: { $sum: "$totalIndicators.penre" },
        },
      },
    ]).session(session);

    return {
      gwp: totals?.gwp || 0,
      ubp: totals?.ubp || 0,
      penre: totals?.penre || 0,
    };
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
      const materials = await Material.find({ _id: { $in: materialIds } })
        .select("_id density kbobMatchId name")
        .populate("kbobMatchId", "GWP UBP PENRE")
        .session(session)
        .lean();

      // Create a map for faster lookups
      const materialMap = new Map(materials.map((m) => [m._id.toString(), m]));

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
                                { $ifNull: ["$$material.kbobMatchId.GWP", 0] },
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
                                { $ifNull: ["$$material.kbobMatchId.UBP", 0] },
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
                                  $ifNull: ["$$material.kbobMatchId.PENRE", 0],
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
