/**
 * KBOB API Service
 * Handles integration with lcadata.ch API and MongoDB caching
 */

import { logger } from "@/lib/logger";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial } from "@/models/kbob";
import { KBOB_API_CONFIG } from "@/lib/config/kbob";
import type { KbobApiResponse, KbobApiMaterial } from "@/types/kbob-api";

export class KbobService {
  // Lock to prevent concurrent syncs
  private static _syncInProgress: Promise<void> | null = null;

  /**
   * Fetch all materials from the lcadata.ch API
   */
  static async fetchFromApi(): Promise<KbobApiResponse> {
    // Validate API key before making request
    if (!KBOB_API_CONFIG.apiKey || typeof KBOB_API_CONFIG.apiKey !== "string" || KBOB_API_CONFIG.apiKey.trim() === "") {
      const error = "KBOB API key is not configured. Set KBOB_API_KEY environment variable.";
      logger.error(`[KBOB Service] ${error}`);
      throw new Error(error);
    }

    const url = `${KBOB_API_CONFIG.baseUrl}/api/kbob/materials?pageSize=all`;

    try {
      logger.info(`[KBOB Service] Fetching materials from API: ${url}`);

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${KBOB_API_CONFIG.apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        // Add timeout
        signal: AbortSignal.timeout(60000), // 60 seconds
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[KBOB Service] API error: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`KBOB API error: ${response.status} ${response.statusText}`);
      }

      const data: KbobApiResponse = await response.json();
      logger.info(`[KBOB Service] Fetched ${data.materials.length} materials from API (version ${data.version})`);

      return data;
    } catch (error) {
      logger.error("[KBOB Service] Failed to fetch from API:", error);
      throw error;
    }
  }

  /**
   * Transform API material to MongoDB document format
   */
  static transformApiMaterial(apiMaterial: KbobApiMaterial, version: string): any {
    // Parse density - can be string or number
    let density: number | null = null;
    if (typeof apiMaterial.density === "number") {
      density = apiMaterial.density;
    } else if (typeof apiMaterial.density === "string" && apiMaterial.density !== "" && apiMaterial.density !== "-") {
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

      // Environmental impact fields
      gwpTotal: apiMaterial.gwpTotal,
      ubp21Total: apiMaterial.ubp21Total,
      primaryEnergyNonRenewableTotal: apiMaterial.primaryEnergyNonRenewableTotal,

      // Density handling
      density: density,
      unit: apiMaterial.unit,
    };
  }

  /**
   * Sync materials from API to MongoDB
   * Updates existing materials by UUID or creates new ones
   */
  static async syncMaterials(): Promise<{ synced: number; errors: number }> {
    await connectToDatabase();

    try {
      const apiResponse = await this.fetchFromApi();
      const { materials, version } = apiResponse;

      let synced = 0;
      let errors = 0;

      logger.info(`[KBOB Service] Starting sync of ${materials.length} materials...`);

      // Process materials in batches to avoid overwhelming MongoDB
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
                  // Only set on insert, not on update
                  createdAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

        try {
          const result = await KBOBMaterial.bulkWrite(bulkOps, { ordered: false });
          synced += result.modifiedCount + result.upsertedCount;
          logger.info(`[KBOB Service] Processed batch ${Math.floor(i / batchSize) + 1}: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`);
        } catch (error) {
          logger.error(`[KBOB Service] Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
          errors += batch.length;
        }
      }

      logger.info(`[KBOB Service] Sync completed: ${synced} materials synced, ${errors} errors`);
      return { synced, errors };
    } catch (error) {
      logger.error("[KBOB Service] Sync failed:", error);
      throw error;
    }
  }

  /**
   * Check if cache needs refresh
   */
  private static async needsRefresh(): Promise<boolean> {
    await connectToDatabase();

    const latestMaterial = await KBOBMaterial.findOne({ lastUpdated: { $exists: true } })
      .sort({ lastUpdated: -1 })
      .lean();

    if (!latestMaterial || !latestMaterial.lastUpdated) {
      logger.info("[KBOB Service] No cached materials found, refresh needed");
      return true;
    }

    const age = Date.now() - new Date(latestMaterial.lastUpdated).getTime();
    const needsRefresh = age > KBOB_API_CONFIG.syncInterval;

    if (needsRefresh) {
      logger.info(`[KBOB Service] Cache is ${Math.floor(age / (60 * 60 * 1000))} hours old, refresh needed`);
    }

    return needsRefresh;
  }

  /**
   * Get materials from cache or API
   * Returns cached materials if fresh, otherwise triggers background sync
   */
  static async getMaterials(forceRefresh: boolean = false): Promise<any[]> {
    try {
      await connectToDatabase();
    } catch (error) {
      logger.error("[KBOB Service] Database connection failed:", error);
      // Return empty array if database connection fails
      // This allows the app to continue working even if DB is unavailable
      return [];
    }

    try {
      // Check if we need to refresh
      const shouldRefresh = forceRefresh || await this.needsRefresh();

      if (shouldRefresh) {
        // Check if sync is already in progress
        if (this._syncInProgress) {
          // Wait for existing sync instead of starting a new one
          logger.info("[KBOB Service] Sync already in progress, waiting for completion...");
          try {
            await this._syncInProgress;
          } catch (error) {
            // Error already logged by syncMaterials, just continue
          }
        } else {
          // Start new sync and store the promise
          this._syncInProgress = this.syncMaterials()
            .then(() => {
              this._syncInProgress = null;
            })
            .catch((error) => {
              logger.error("[KBOB Service] Background sync failed:", error);
              this._syncInProgress = null;
            });

          // Don't await to avoid blocking, but store promise for other callers
        }
      }

      // Return cached materials (even if stale, better than nothing)
      const materials = await (KBOBMaterial.findValidMaterials() as any).lean();

      if (materials.length === 0 && shouldRefresh) {
        // If no cache and we're refreshing, wait a bit for sync to complete
        logger.info("[KBOB Service] No cached materials, waiting for initial sync...");
        try {
          // Use the existing sync promise if available, otherwise start one
          if (!this._syncInProgress) {
            // Start sync and store the promise
            this._syncInProgress = this.syncMaterials()
              .then(() => {
                this._syncInProgress = null;
              })
              .catch((error) => {
                logger.error("[KBOB Service] Initial sync failed:", error);
                this._syncInProgress = null;
                throw error;
              });
          }

          // Wait for sync with timeout
          await Promise.race([
            this._syncInProgress,
            new Promise((resolve) => setTimeout(resolve, 5000)), // Max 5 second wait
          ]);
          // Try again after sync
          return await (KBOBMaterial.findValidMaterials() as any).lean();
        } catch (error) {
          logger.error("[KBOB Service] Initial sync failed:", error);
          return [];
        }
      }

      return materials;
    } catch (error) {
      logger.error("[KBOB Service] Error getting materials:", error);
      // Return empty array on error to prevent 500 errors
      return [];
    }
  }

  /**
   * Get a single material by UUID
   */
  static async getMaterialByUuid(uuid: string): Promise<any | null> {
    await connectToDatabase();
    return await KBOBMaterial.findOne({ uuid }).lean();
  }

}

