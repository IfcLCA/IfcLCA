/**
 * OpenEPD LCA Service
 * Implements ILcaDataService for Building Transparency EC3/OpenEPD database
 * Requires API key from EC3 account (free registration)
 */

import { logger } from "@/lib/logger";
import { connectToDatabase } from "@/lib/mongodb";
import { OpenEpdMaterial, type IOpenEpdMaterial } from "@/models/openepd";
import type {
  ILcaDataService,
  LcaDataSource,
  LcaIndicator,
  LcaMaterialData,
  LcaMaterialSearchResult,
} from "@/lib/types/lca";
import { createLcaMaterialId } from "@/lib/types/lca";

// Configuration
const OPENEPD_CONFIG = {
  // EC3 API base URL
  baseUrl:
    process.env.OPENEPD_BASE_URL || "https://openepd.buildingtransparency.org",
  apiKey: process.env.OPENEPD_API_KEY,
  syncInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  requestTimeout: 30000, // 30 seconds
};

interface OpenEpdSearchResult {
  id: string;
  name?: string;
  product_name?: string;
  manufacturer?: { name?: string };
  category?: { name?: string };
  declared_unit?: string;
  gwp?: {
    a1a2a3?: number;
    c?: number;
    total?: number;
  };
  plant_or_group?: {
    owned_by?: { name?: string };
  };
  valid_until?: string;
  program_operator?: { name?: string };
}

interface OpenEpdSearchResponse {
  results?: OpenEpdSearchResult[];
  count?: number;
  next?: string;
}

export class OpenEpdLcaService implements ILcaDataService {
  readonly source: LcaDataSource = "openepd";
  readonly displayName = "OpenEPD / EC3 (Global)";
  readonly countryFlag = "🌍";

  private cache: Map<string, LcaMaterialData> = new Map();

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return Boolean(OPENEPD_CONFIG.apiKey);
  }

  getAvailableIndicators(): LcaIndicator[] {
    // OpenEPD focuses primarily on GWP
    return ["gwp"];
  }

  /**
   * Check if cache needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    await connectToDatabase();

    const latestMaterial = await OpenEpdMaterial.findOne({
      lastUpdated: { $exists: true },
    })
      .sort({ lastUpdated: -1 })
      .lean();

    if (!latestMaterial || !latestMaterial.lastUpdated) {
      logger.info("[OpenEPD LCA] No cached materials found");
      return true;
    }

    const age = Date.now() - new Date(latestMaterial.lastUpdated).getTime();
    return age > OPENEPD_CONFIG.syncInterval;
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HeadersInit {
    if (!OPENEPD_CONFIG.apiKey) {
      throw new Error("OpenEPD API key not configured. Set OPENEPD_API_KEY environment variable.");
    }

    return {
      Authorization: `Bearer ${OPENEPD_CONFIG.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  /**
   * Normalize GWP to per-kg value
   * OpenEPD provides GWP per declared unit
   */
  private normalizeGwpToPerKg(
    gwpDeclared: number,
    declaredUnit: string,
    density?: number
  ): number | null {
    const unit = (declaredUnit || "").toLowerCase().trim();

    // Already per kg
    if (unit === "kg" || unit === "1 kg") {
      return gwpDeclared;
    }

    // Per m³ - need density
    if (unit === "m3" || unit === "1 m3" || unit.includes("m³")) {
      if (!density || density <= 0) {
        // Without density, we can't normalize - return null
        return null;
      }
      return gwpDeclared / density;
    }

    // Per tonne/metric ton
    if (unit === "t" || unit === "1 t" || unit === "tonne" || unit === "metric ton") {
      return gwpDeclared / 1000;
    }

    // Per m² - area-based, skip (would need grammage)
    if (unit === "m2" || unit.includes("m²")) {
      return null;
    }

    // For other units we can't reliably normalize, return the value as-is
    // with a warning in logs
    logger.debug(`[OpenEPD LCA] Unknown unit '${declaredUnit}', using GWP as-is`);
    return gwpDeclared;
  }

  /**
   * Transform API result to database format
   */
  private transformApiResult(result: OpenEpdSearchResult): IOpenEpdMaterial | null {
    const id = result.id;
    if (!id) return null;

    // Extract GWP values
    const gwpA1A2A3 = result.gwp?.a1a2a3;
    const gwpC = result.gwp?.c;
    let gwpDeclared = result.gwp?.total;

    // Calculate total if not provided
    if (gwpDeclared === undefined || gwpDeclared === null) {
      if (gwpA1A2A3 !== undefined && gwpA1A2A3 !== null) {
        gwpDeclared = gwpA1A2A3 + (gwpC || 0);
      } else {
        return null; // No GWP data
      }
    }

    const declaredUnit = result.declared_unit || "kg";
    const name =
      result.product_name ||
      result.name ||
      result.plant_or_group?.owned_by?.name ||
      "Unknown";

    // Try to normalize to per-kg
    // Note: OpenEPD doesn't always provide density, so we may not be able to normalize
    const gwpTotal = this.normalizeGwpToPerKg(gwpDeclared, declaredUnit);

    if (gwpTotal === null) {
      return null;
    }

    return {
      id,
      name,
      productName: result.product_name,
      manufacturerName:
        result.manufacturer?.name ||
        result.plant_or_group?.owned_by?.name,
      category: result.category?.name,
      declaredUnit,
      gwpDeclared,
      gwpA1A2A3,
      gwpC,
      gwpTotal,
      programOperator: result.program_operator?.name,
      validUntil: result.valid_until ? new Date(result.valid_until) : undefined,
      lastUpdated: new Date(),
    };
  }

  /**
   * Transform database record to unified format
   */
  private toUnifiedFormat(material: IOpenEpdMaterial): LcaMaterialData {
    return {
      id: createLcaMaterialId("openepd", material.id),
      sourceId: material.id,
      source: "openepd",
      name: material.name,
      category: material.category,
      density: material.density || 0,
      declaredUnit: material.declaredUnit,
      gwp: material.gwpTotal,
      ubp: null, // OpenEPD doesn't have UBP
      penre: null, // OpenEPD doesn't always have PENRE
      validUntil: material.validUntil,
      lastUpdated: material.lastUpdated,
      epdUrl: material.epdUrl,
    };
  }

  /**
   * Transform database record to search result format
   */
  private toSearchResult(material: IOpenEpdMaterial): LcaMaterialSearchResult {
    return {
      id: createLcaMaterialId("openepd", material.id),
      sourceId: material.id,
      source: "openepd",
      name: material.name,
      category: material.category,
      density: material.density || null,
      gwp: material.gwpTotal,
      ubp: null,
      penre: null,
    };
  }

  /**
   * Search materials via OpenEPD API
   */
  async search(query: string, limit: number = 50): Promise<LcaMaterialSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    if (!this.isConfigured()) {
      logger.warn("[OpenEPD LCA] API key not configured, searching cache only");
      return this.searchCache(query, limit);
    }

    // First check cache
    await connectToDatabase();
    const cachedResults = await this.searchCache(query, Math.min(limit, 20));

    // Search API
    const url = new URL(`${OPENEPD_CONFIG.baseUrl}/api/epds`);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", String(limit));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OPENEPD_CONFIG.requestTimeout
      );

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: this.getHeaders(),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logger.error("[OpenEPD LCA] Authentication failed - check API key");
        } else {
          logger.warn(`[OpenEPD LCA] Search API error: ${response.status}`);
        }
        return cachedResults;
      }

      const data: OpenEpdSearchResponse = await response.json();
      const results = data?.results || [];

      if (!Array.isArray(results)) {
        return cachedResults;
      }

      // Transform and cache results
      const materials: LcaMaterialSearchResult[] = [];

      for (const result of results) {
        const material = this.transformApiResult(result);
        if (!material) continue;

        // Cache in database
        try {
          await OpenEpdMaterial.findOneAndUpdate(
            { id: material.id },
            { $set: material },
            { upsert: true }
          );
        } catch {
          // Ignore cache errors
        }

        materials.push(this.toSearchResult(material));
      }

      // Combine with cached results (deduplicated)
      const seenIds = new Set(materials.map((m) => m.id));
      for (const cached of cachedResults) {
        if (!seenIds.has(cached.id)) {
          materials.push(cached);
        }
      }

      return materials.slice(0, limit);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        logger.warn("[OpenEPD LCA] Search request timed out");
      } else {
        logger.error("[OpenEPD LCA] Search error:", error);
      }
      return cachedResults;
    }
  }

  /**
   * Search cached materials
   */
  private async searchCache(
    query: string,
    limit: number
  ): Promise<LcaMaterialSearchResult[]> {
    await connectToDatabase();

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const results = await OpenEpdMaterial.find({
      $or: [
        { name: { $regex: escapedQuery, $options: "i" } },
        { productName: { $regex: escapedQuery, $options: "i" } },
        { category: { $regex: escapedQuery, $options: "i" } },
      ],
      gwpTotal: { $exists: true, $ne: null },
    })
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    return results.map((m) => this.toSearchResult(m));
  }

  /**
   * Get a single material by ID
   */
  async getById(id: string): Promise<LcaMaterialData | null> {
    const prefix = "OPENEPD_";
    if (!id.startsWith(prefix)) {
      return null;
    }
    const sourceId = id.slice(prefix.length);

    // Check memory cache
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    await connectToDatabase();

    // Check database cache
    const cached = await OpenEpdMaterial.findOne({ id: sourceId }).lean();
    if (cached) {
      const material = this.toUnifiedFormat(cached);
      this.cache.set(id, material);
      return material;
    }

    // Fetch from API if configured
    if (!this.isConfigured()) {
      return null;
    }

    const url = `${OPENEPD_CONFIG.baseUrl}/api/epds/${sourceId}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OPENEPD_CONFIG.requestTimeout
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: this.getHeaders(),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`[OpenEPD LCA] Failed to fetch EPD ${sourceId}: ${response.status}`);
        return null;
      }

      const result: OpenEpdSearchResult = await response.json();
      const material = this.transformApiResult(result);

      if (!material) {
        return null;
      }

      // Cache in database
      try {
        await OpenEpdMaterial.findOneAndUpdate(
          { id: material.id },
          { $set: material },
          { upsert: true }
        );
      } catch {
        // Ignore cache errors
      }

      const unified = this.toUnifiedFormat(material);
      this.cache.set(id, unified);
      return unified;
    } catch (error) {
      logger.error(`[OpenEPD LCA] Error fetching EPD ${sourceId}:`, error);
      return null;
    }
  }

  /**
   * Get all materials from cache
   */
  async getAll(): Promise<LcaMaterialData[]> {
    await connectToDatabase();

    const materials = (await OpenEpdMaterial.findValidMaterials().lean()) as unknown as IOpenEpdMaterial[];
    return materials.map((m) => this.toUnifiedFormat(m));
  }

  /**
   * Sync materials from OpenEPD
   * Note: OpenEPD doesn't have a bulk export, so this returns cache status
   */
  async sync(): Promise<{ synced: number; errors: number }> {
    if (!this.isConfigured()) {
      logger.warn(
        "[OpenEPD LCA] API key not configured - set OPENEPD_API_KEY to enable sync"
      );
      return { synced: 0, errors: 0 };
    }

    logger.info(
      "[OpenEPD LCA] OpenEPD materials are cached on-demand during search"
    );

    await connectToDatabase();
    const count = await OpenEpdMaterial.countDocuments({
      gwpTotal: { $exists: true, $ne: null },
    });

    return { synced: count, errors: 0 };
  }
}

// Singleton instance
let _instance: OpenEpdLcaService | null = null;

export function getOpenEpdLcaService(): OpenEpdLcaService {
  if (!_instance) {
    _instance = new OpenEpdLcaService();
  }
  return _instance;
}
