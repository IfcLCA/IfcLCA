/**
 * KBOB LCA Service
 * Implements ILcaDataService for Swiss KBOB materials database
 * Wraps existing KbobService with unified interface
 */

import { logger } from "@/lib/logger";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial } from "@/models/kbob";
import { KBOB_API_CONFIG } from "@/lib/config/kbob";
import type { KbobApiResponse, KbobApiMaterial } from "@/types/kbob-api";
import type {
  ILcaDataService,
  LcaDataSource,
  LcaIndicator,
  LcaMaterialData,
  LcaMaterialSearchResult,
} from "@/lib/types/lca";
import { createLcaMaterialId } from "@/lib/types/lca";

export class KbobLcaService implements ILcaDataService {
  readonly source: LcaDataSource = "kbob";
  readonly displayName = "KBOB (Switzerland)";
  readonly countryFlag = "🇨🇭";

  // Lock to prevent concurrent syncs
  private static _syncInProgress: Promise<void> | null = null;

  getAvailableIndicators(): LcaIndicator[] {
    return ["gwp", "ubp", "penre"];
  }

  /**
   * Check if cache needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    await connectToDatabase();

    const latestMaterial = await KBOBMaterial.findOne({
      lastUpdated: { $exists: true },
    })
      .sort({ lastUpdated: -1 })
      .lean();

    if (!latestMaterial || !latestMaterial.lastUpdated) {
      logger.info("[KBOB LCA] No cached materials found, refresh needed");
      return true;
    }

    const age =
      Date.now() - new Date(latestMaterial.lastUpdated).getTime();
    const needsRefresh = age > KBOB_API_CONFIG.syncInterval;

    if (needsRefresh) {
      logger.info(
        `[KBOB LCA] Cache is ${Math.floor(age / (60 * 60 * 1000))} hours old, refresh needed`
      );
    }

    return needsRefresh;
  }

  /**
   * Fetch all materials from the lcadata.ch API
   */
  private async fetchFromApi(): Promise<KbobApiResponse> {
    if (
      !KBOB_API_CONFIG.apiKey ||
      typeof KBOB_API_CONFIG.apiKey !== "string" ||
      KBOB_API_CONFIG.apiKey.trim() === ""
    ) {
      const error =
        "KBOB API key is not configured. Set KBOB_API_KEY environment variable.";
      logger.error(`[KBOB LCA] ${error}`);
      throw new Error(error);
    }

    const url = `${KBOB_API_CONFIG.baseUrl}/api/kbob/materials?pageSize=all`;

    try {
      logger.info(`[KBOB LCA] Fetching materials from API: ${url}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${KBOB_API_CONFIG.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[KBOB LCA] API error: ${response.status} ${response.statusText} - ${errorText}`
        );
        throw new Error(
          `KBOB API error: ${response.status} ${response.statusText}`
        );
      }

      const data: KbobApiResponse = await response.json();
      logger.info(
        `[KBOB LCA] Fetched ${data.materials.length} materials from API (version ${data.version})`
      );

      return data;
    } catch (error) {
      logger.error("[KBOB LCA] Failed to fetch from API:", error);
      throw error;
    }
  }

  /**
   * Transform API material to MongoDB document format
   */
  private transformApiMaterial(
    apiMaterial: KbobApiMaterial,
    version: string
  ): any {
    let density: number | null = null;
    if (typeof apiMaterial.density === "number") {
      density = apiMaterial.density;
    } else if (
      typeof apiMaterial.density === "string" &&
      apiMaterial.density !== "" &&
      apiMaterial.density !== "-"
    ) {
      const parsed = parseFloat(apiMaterial.density);
      if (!isNaN(parsed)) {
        density = parsed;
      }
    }

    return {
      uuid: apiMaterial.uuid,
      nameDE: apiMaterial.nameDE,
      nameFR: apiMaterial.nameFR,
      Name: apiMaterial.nameDE,
      group: apiMaterial.group,
      Category: apiMaterial.group,
      version: version,
      lastUpdated: new Date(),
      gwpTotal: apiMaterial.gwpTotal,
      ubp21Total: apiMaterial.ubp21Total,
      primaryEnergyNonRenewableTotal: apiMaterial.primaryEnergyNonRenewableTotal,
      density: density,
      unit: apiMaterial.unit,
    };
  }

  /**
   * Transform MongoDB document to unified LcaMaterialData format
   */
  private toUnifiedFormat(kbob: any): LcaMaterialData {
    const density =
      typeof kbob.density === "number"
        ? kbob.density
        : parseFloat(kbob.density) || 0;

    return {
      id: createLcaMaterialId("kbob", kbob.uuid),
      sourceId: kbob.uuid,
      source: "kbob",
      name: kbob.Name || kbob.nameDE || "Unknown",
      nameDE: kbob.nameDE,
      nameFR: kbob.nameFR,
      category: kbob.group || kbob.Category,
      density: density,
      declaredUnit: kbob.unit || "kg",
      gwp: kbob.gwpTotal ?? 0,
      ubp: kbob.ubp21Total ?? null,
      penre: kbob.primaryEnergyNonRenewableTotal ?? null,
      version: kbob.version,
      lastUpdated: kbob.lastUpdated,
    };
  }

  /**
   * Transform MongoDB document to search result format
   */
  private toSearchResult(kbob: any): LcaMaterialSearchResult {
    const density =
      typeof kbob.density === "number"
        ? kbob.density
        : parseFloat(kbob.density) || null;

    return {
      id: createLcaMaterialId("kbob", kbob.uuid),
      sourceId: kbob.uuid,
      source: "kbob",
      name: kbob.Name || kbob.nameDE || "Unknown",
      nameDE: kbob.nameDE,
      category: kbob.group || kbob.Category,
      density: density,
      gwp: kbob.gwpTotal ?? null,
      ubp: kbob.ubp21Total ?? null,
      penre: kbob.primaryEnergyNonRenewableTotal ?? null,
    };
  }

  /**
   * Sync materials from API to MongoDB
   */
  async sync(): Promise<{ synced: number; errors: number }> {
    await connectToDatabase();

    try {
      const apiResponse = await this.fetchFromApi();
      const { materials, version } = apiResponse;

      let synced = 0;
      let errors = 0;

      logger.info(
        `[KBOB LCA] Starting sync of ${materials.length} materials...`
      );

      const batchSize = 100;
      for (let i = 0; i < materials.length; i += batchSize) {
        const batch = materials.slice(i, i + batchSize);

        const bulkOps = batch.map((apiMaterial) => {
          const transformed = this.transformApiMaterial(apiMaterial, version);

          return {
            updateOne: {
              filter: { uuid: apiMaterial.uuid },
              update: {
                $set: transformed,
                $setOnInsert: {
                  createdAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

        try {
          const result = await KBOBMaterial.bulkWrite(bulkOps, {
            ordered: false,
          });
          synced += result.modifiedCount + result.upsertedCount;
          logger.info(
            `[KBOB LCA] Processed batch ${Math.floor(i / batchSize) + 1}: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`
          );
        } catch (error) {
          logger.error(
            `[KBOB LCA] Error processing batch ${Math.floor(i / batchSize) + 1}:`,
            error
          );
          errors += batch.length;
        }
      }

      logger.info(
        `[KBOB LCA] Sync completed: ${synced} materials synced, ${errors} errors`
      );
      return { synced, errors };
    } catch (error) {
      logger.error("[KBOB LCA] Sync failed:", error);
      throw error;
    }
  }

  /**
   * Search materials by query
   */
  async search(query: string, limit: number = 50): Promise<LcaMaterialSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    await connectToDatabase();

    try {
      // Escape special regex characters
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const materials = await KBOBMaterial.find({
        $and: [
          // Must have valid indicators
          { gwpTotal: { $exists: true, $ne: null } },
          { ubp21Total: { $exists: true, $ne: null } },
          { primaryEnergyNonRenewableTotal: { $exists: true, $ne: null } },
          { density: { $exists: true, $ne: null, $nin: ["-", "", 0] } },
          // Search in name fields
          {
            $or: [
              { Name: { $regex: escapedQuery, $options: "i" } },
              { nameDE: { $regex: escapedQuery, $options: "i" } },
              { nameFR: { $regex: escapedQuery, $options: "i" } },
              { group: { $regex: escapedQuery, $options: "i" } },
            ],
          },
        ],
      })
        .limit(limit)
        .sort({ Name: 1 })
        .lean();

      return materials.map((m) => this.toSearchResult(m));
    } catch (error) {
      logger.error("[KBOB LCA] Search error:", error);
      return [];
    }
  }

  /**
   * Get a single material by ID
   */
  async getById(id: string): Promise<LcaMaterialData | null> {
    // Extract UUID from prefixed ID
    const prefix = "KBOB_";
    if (!id.startsWith(prefix)) {
      return null;
    }
    const uuid = id.slice(prefix.length);

    await connectToDatabase();

    const material = await KBOBMaterial.findOne({ uuid }).lean();
    if (!material) {
      return null;
    }

    return this.toUnifiedFormat(material);
  }

  /**
   * Get all valid materials from cache
   */
  async getAll(): Promise<LcaMaterialData[]> {
    try {
      await connectToDatabase();
    } catch (error) {
      logger.error("[KBOB LCA] Database connection failed:", error);
      return [];
    }

    try {
      const shouldRefresh = await this.needsRefresh();

      if (shouldRefresh) {
        if (KbobLcaService._syncInProgress) {
          logger.info(
            "[KBOB LCA] Sync already in progress, waiting for completion..."
          );
          try {
            await KbobLcaService._syncInProgress;
          } catch {
            // Error already logged
          }
        } else {
          KbobLcaService._syncInProgress = this.sync()
            .then(() => {
              KbobLcaService._syncInProgress = null;
            })
            .catch((error) => {
              logger.error("[KBOB LCA] Background sync failed:", error);
              KbobLcaService._syncInProgress = null;
            });
        }
      }

      const materials = await (
        KBOBMaterial.findValidMaterials() as any
      ).lean();

      if (materials.length === 0 && shouldRefresh) {
        logger.info(
          "[KBOB LCA] No cached materials, waiting for initial sync..."
        );
        try {
          if (!KbobLcaService._syncInProgress) {
            KbobLcaService._syncInProgress = this.sync()
              .then(() => {
                KbobLcaService._syncInProgress = null;
              })
              .catch((error) => {
                logger.error("[KBOB LCA] Initial sync failed:", error);
                KbobLcaService._syncInProgress = null;
                throw error;
              });
          }

          await Promise.race([
            KbobLcaService._syncInProgress,
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);

          const refreshedMaterials = await (
            KBOBMaterial.findValidMaterials() as any
          ).lean();
          return refreshedMaterials.map((m: any) => this.toUnifiedFormat(m));
        } catch (error) {
          logger.error("[KBOB LCA] Initial sync failed:", error);
          return [];
        }
      }

      return materials.map((m: any) => this.toUnifiedFormat(m));
    } catch (error) {
      logger.error("[KBOB LCA] Error getting materials:", error);
      return [];
    }
  }
}

// Singleton instance
let _instance: KbobLcaService | null = null;

export function getKbobLcaService(): KbobLcaService {
  if (!_instance) {
    _instance = new KbobLcaService();
  }
  return _instance;
}
