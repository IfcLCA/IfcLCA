/**
 * ÖKOBAUDAT LCA Service
 * Implements ILcaDataService for German ÖKOBAUDAT EPD database
 * Free API access, no authentication required
 */

import { logger } from "@/lib/logger";
import { connectToDatabase } from "@/lib/mongodb";
import { OkobaudatMaterial, type IOkobaudatMaterial } from "@/models/okobaudat";
import type {
  ILcaDataService,
  LcaDataSource,
  LcaIndicator,
  LcaMaterialData,
  LcaMaterialSearchResult,
} from "@/lib/types/lca";
import { createLcaMaterialId } from "@/lib/types/lca";

// Configuration
const OKOBAUDAT_CONFIG = {
  baseUrl:
    process.env.OKOBAUDAT_BASE_URL ||
    "https://oekobaudat.de/OEKOBAU.DAT/resource",
  datastockId:
    process.env.OKOBAUDAT_DATASTOCK_ID ||
    "cd2bda71-760b-4fcc-8a0b-3877c10000a8",
  complianceA2:
    process.env.OKOBAUDAT_COMPLIANCE_A2 ||
    "c0016b33-8cf7-415c-ac6e-deba0d21440d",
  syncInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  requestTimeout: 30000, // 30 seconds
};

interface OkobaudatProcessInfo {
  uuid: string;
  name?: string | { value: string; lang: string }[];
}

interface OkobaudatSearchResponse {
  data?: OkobaudatProcessInfo[];
  totalCount?: number;
}

export class OkobaudatLcaService implements ILcaDataService {
  readonly source: LcaDataSource = "okobaudat";
  readonly displayName = "ÖKOBAUDAT (Germany)";
  readonly countryFlag = "🇩🇪";

  private cache: Map<string, LcaMaterialData> = new Map();

  getAvailableIndicators(): LcaIndicator[] {
    // ÖKOBAUDAT has GWP and PENRE but not UBP (Swiss-specific)
    return ["gwp", "penre"];
  }

  /**
   * Check if cache needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    await connectToDatabase();

    const latestMaterial = await OkobaudatMaterial.findOne({
      lastUpdated: { $exists: true },
    })
      .sort({ lastUpdated: -1 })
      .lean();

    if (!latestMaterial || !latestMaterial.lastUpdated) {
      logger.info("[ÖKOBAUDAT LCA] No cached materials found");
      return true;
    }

    const age = Date.now() - new Date(latestMaterial.lastUpdated).getTime();
    const needsRefresh = age > OKOBAUDAT_CONFIG.syncInterval;

    if (needsRefresh) {
      logger.info(
        `[ÖKOBAUDAT LCA] Cache is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old`
      );
    }

    return needsRefresh;
  }

  /**
   * Extract name from ÖKOBAUDAT EPD data structure
   */
  private extractEpdName(epdData: any): string {
    try {
      const processInfo = epdData?.processInformation || {};
      const datasetInfo = processInfo?.dataSetInformation || {};
      const nameObj = datasetInfo?.name || {};
      const baseNames = nameObj?.baseName || [];

      if (!baseNames || baseNames.length === 0) {
        return epdData?.uuid || "Unknown";
      }

      // Prefer German name
      for (const entry of baseNames) {
        if (entry?.lang === "de" && entry?.value) {
          return entry.value;
        }
      }

      // Fallback to English
      for (const entry of baseNames) {
        if (entry?.lang === "en" && entry?.value) {
          return entry.value;
        }
      }

      // Fallback to first entry
      if (baseNames[0]?.value) {
        return baseNames[0].value;
      }
    } catch {
      // Ignore parsing errors
    }

    return epdData?.uuid || "Unknown";
  }

  /**
   * Extract reference exchange from EPD data
   */
  private extractReferenceExchange(epdData: any): any | null {
    const exchanges = epdData?.exchanges;
    if (!exchanges || typeof exchanges !== "object") {
      return null;
    }

    const exchangeList = exchanges?.exchange;
    if (!Array.isArray(exchangeList)) {
      return null;
    }

    for (const exchange of exchangeList) {
      if (exchange?.referenceFlow) {
        return exchange;
      }
    }

    return null;
  }

  /**
   * Extract declared unit from reference exchange
   */
  private extractDeclaredUnit(referenceExchange: any): string {
    const flowProps = referenceExchange?.flowProperties;
    if (!flowProps || !Array.isArray(flowProps)) {
      return "unknown";
    }

    // Find reference flow property
    const refProp =
      flowProps.find((p: any) => p?.referenceFlowProperty) || flowProps[0];

    const unit = refProp?.referenceUnit || "unknown";
    // Normalize common variations
    return unit.toLowerCase().replace("³", "3").replace("²", "2");
  }

  /**
   * Extract density from material properties
   */
  private extractDensity(referenceExchange: any): number | null {
    const materialProps = referenceExchange?.materialProperties;
    if (!materialProps || !Array.isArray(materialProps)) {
      return null;
    }

    for (const prop of materialProps) {
      const propName = (prop?.name || "").toLowerCase();
      const propValue = prop?.value;

      if (
        (propName.includes("density") || propName.includes("rohdichte")) &&
        propValue
      ) {
        const parsed = parseFloat(propValue);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }

    return null;
  }

  /**
   * Extract GWP-total from LCIAResults
   * Sums A1-A3 + C3 (or C4) to match KBOB "Total" methodology per EN 15978/15804
   */
  private extractGwpTotal(epdData: any): number | null {
    const lciaResults = epdData?.LCIAResults;
    if (!lciaResults || typeof lciaResults !== "object") {
      return null;
    }

    const lciaResultList = lciaResults?.LCIAResult;
    if (!Array.isArray(lciaResultList)) {
      return null;
    }

    // Look for GWP indicator (prefer GWP-total)
    let bestResult: any = null;

    for (const result of lciaResultList) {
      const methodRef = result?.referenceToLCIAMethodDataSet || {};
      const shortDesc = methodRef?.shortDescription || [];

      for (const desc of shortDesc) {
        if (typeof desc !== "object") continue;
        const value = (desc?.value || "").toLowerCase();
        const lang = desc?.lang || "";

        if (
          (lang === "en" || lang === "de") &&
          value.includes("global warming potential")
        ) {
          // Prefer "total" if available
          if (value.includes("total")) {
            bestResult = result;
            break;
          } else if (!bestResult) {
            bestResult = result;
          }
        }
      }
      if (bestResult && (bestResult as any)?.isTotal) break;
    }

    if (!bestResult) {
      return null;
    }

    // First try direct amount field
    const amount = bestResult?.amount;
    if (amount !== undefined && amount !== null) {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    // ÖKOBAUDAT stores values in other.anies with module breakdown
    // Sum A1-A3 + C3 or C4 (end-of-life) for consistency with KBOB "Total"
    const other = bestResult?.other || {};
    const anies = Array.isArray(other?.anies) ? other.anies : [];

    let gwpSum = 0;
    let foundValues = false;
    let hasA1A3Combined = false;
    let a1a3CombinedValue = 0;
    let a1Value = 0;
    let a2Value = 0;
    let a3Value = 0;
    let c3Value = 0;
    let c4Value = 0;
    let hasC3 = false;
    let hasC4 = false;

    for (const entry of anies) {
      if (typeof entry !== "object") continue;
      const moduleCode = entry?.module || "";
      const val = parseFloat(entry?.value);
      if (isNaN(val)) continue;

      if (moduleCode === "A1-A3") {
        hasA1A3Combined = true;
        a1a3CombinedValue = val;
        foundValues = true;
      } else if (moduleCode === "A1") {
        a1Value = val;
      } else if (moduleCode === "A2") {
        a2Value = val;
      } else if (moduleCode === "A3") {
        a3Value = val;
      } else if (moduleCode === "C3") {
        hasC3 = true;
        c3Value = val;
      } else if (moduleCode === "C4") {
        hasC4 = true;
        c4Value = val;
      }
    }

    // Use A1-A3 combined if available, otherwise sum individual
    if (hasA1A3Combined) {
      gwpSum += a1a3CombinedValue;
    } else if (a1Value !== 0 || a2Value !== 0 || a3Value !== 0) {
      gwpSum += a1Value + a2Value + a3Value;
      foundValues = true;
    }

    // Add C3 or C4 (prefer C3 if both available)
    if (hasC3) {
      gwpSum += c3Value;
    } else if (hasC4) {
      gwpSum += c4Value;
    }

    return foundValues ? gwpSum : null;
  }

  /**
   * Normalize GWP from declared unit to per-kg
   */
  private normalizeGwpToPerKg(
    gwpDeclared: number,
    declaredUnit: string,
    density: number
  ): number | null {
    const unit = declaredUnit.toLowerCase().trim();

    if (unit === "kg") {
      return gwpDeclared;
    } else if (unit === "m3" || unit === "m³" || unit === "cbm") {
      if (!density || density <= 0) {
        return null;
      }
      return gwpDeclared / density;
    } else if (unit === "m2" || unit === "m²" || unit === "qm") {
      // Area-based units need grammage (kg/m²) - skip
      return null;
    } else if (unit === "m" || unit === "lfm" || unit === "lm") {
      // Linear meter - skip
      return null;
    } else if (
      unit === "stk" ||
      unit === "stück" ||
      unit === "pcs" ||
      unit === "piece"
    ) {
      // Per piece - skip
      return null;
    }

    return null;
  }

  /**
   * Fetch a single material's full EPD data
   */
  private async fetchEpdData(uuid: string): Promise<any | null> {
    const url = `${OKOBAUDAT_CONFIG.baseUrl}/datastocks/${OKOBAUDAT_CONFIG.datastockId}/processes/${uuid}`;
    const params = new URLSearchParams({
      format: "json",
      view: "extended",
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OKOBAUDAT_CONFIG.requestTimeout
      );

      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.debug(`[ÖKOBAUDAT LCA] Failed to fetch EPD ${uuid}: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        logger.debug(`[ÖKOBAUDAT LCA] Timeout fetching EPD ${uuid}`);
      } else {
        logger.debug(`[ÖKOBAUDAT LCA] Error fetching EPD ${uuid}:`, error);
      }
      return null;
    }
  }

  /**
   * Extract name from process search result
   */
  private extractNameFromProcess(process: OkobaudatProcessInfo): string {
    const name = process.name;

    if (typeof name === "string") {
      return name;
    }

    if (Array.isArray(name)) {
      // Prefer German, then English
      for (const entry of name) {
        if (entry?.lang === "de" && entry?.value) {
          return entry.value;
        }
      }
      for (const entry of name) {
        if (entry?.lang === "en" && entry?.value) {
          return entry.value;
        }
      }
      if (name[0]?.value) {
        return name[0].value;
      }
    }

    return process.uuid || "Unknown";
  }

  /**
   * Transform database record to unified format
   */
  private toUnifiedFormat(material: IOkobaudatMaterial): LcaMaterialData {
    return {
      id: createLcaMaterialId("okobaudat", material.uuid),
      sourceId: material.uuid,
      source: "okobaudat",
      name: material.name,
      nameDE: material.nameDE,
      category: material.category,
      density: material.density,
      declaredUnit: material.declaredUnit,
      gwp: material.gwpTotal,
      ubp: null, // ÖKOBAUDAT doesn't have UBP
      penre: material.penreTotal ?? null,
      version: material.version,
      lastUpdated: material.lastUpdated,
      epdUrl: material.epdUrl,
      validUntil: material.validUntil,
    };
  }

  /**
   * Transform database record to search result format
   */
  private toSearchResult(material: IOkobaudatMaterial): LcaMaterialSearchResult {
    return {
      id: createLcaMaterialId("okobaudat", material.uuid),
      sourceId: material.uuid,
      source: "okobaudat",
      name: material.name,
      nameDE: material.nameDE,
      category: material.category,
      density: material.density,
      gwp: material.gwpTotal,
      ubp: null,
      penre: material.penreTotal ?? null,
    };
  }

  /**
   * Search materials via ÖKOBAUDAT API (live search)
   */
  async search(query: string, limit: number = 50): Promise<LcaMaterialSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // First, try to search in cached database
    await connectToDatabase();

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cachedResults = await OkobaudatMaterial.find({
      $or: [
        { name: { $regex: escapedQuery, $options: "i" } },
        { nameDE: { $regex: escapedQuery, $options: "i" } },
      ],
      gwpTotal: { $exists: true, $ne: null },
      density: { $exists: true, $gt: 0 },
    })
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    if (cachedResults.length >= limit) {
      return cachedResults.map((m) => this.toSearchResult(m));
    }

    // If not enough cached results, search API
    const url = `${OKOBAUDAT_CONFIG.baseUrl}/datastocks/${OKOBAUDAT_CONFIG.datastockId}/processes`;
    const params = new URLSearchParams({
      format: "json",
      search: "true",
      name: query,
      compliance: OKOBAUDAT_CONFIG.complianceA2,
      pageSize: String(limit),
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OKOBAUDAT_CONFIG.requestTimeout
      );

      const response = await fetch(`${url}?${params}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`[ÖKOBAUDAT LCA] Search API error: ${response.status}`);
        return cachedResults.map((m) => this.toSearchResult(m));
      }

      const data: OkobaudatSearchResponse = await response.json();
      const processes = data?.data || [];

      if (!Array.isArray(processes)) {
        return cachedResults.map((m) => this.toSearchResult(m));
      }

      // Fetch full EPD data for each process (in parallel, limited concurrency)
      const results: LcaMaterialSearchResult[] = [];
      const batchSize = 5;

      for (let i = 0; i < Math.min(processes.length, limit); i += batchSize) {
        const batch = processes.slice(i, i + batchSize);

        const batchPromises = batch.map(async (process) => {
          const uuid = process.uuid;
          if (!uuid) return null;

          // Check cache first
          const cached = await OkobaudatMaterial.findOne({ uuid }).lean();
          if (cached) {
            return this.toSearchResult(cached);
          }

          // Fetch full EPD data
          const epdData = await this.fetchEpdData(uuid);
          if (!epdData) return null;

          const refExchange = this.extractReferenceExchange(epdData);
          if (!refExchange) return null;

          const density = this.extractDensity(refExchange);
          if (!density || density <= 0) return null;

          const gwpDeclared = this.extractGwpTotal(epdData);
          if (gwpDeclared === null) return null;

          const declaredUnit = this.extractDeclaredUnit(refExchange);
          const gwpTotal = this.normalizeGwpToPerKg(
            gwpDeclared,
            declaredUnit,
            density
          );

          if (gwpTotal === null) return null;

          const name = this.extractEpdName(epdData);

          // Cache the result
          const materialData: IOkobaudatMaterial = {
            uuid,
            name,
            nameDE: name,
            density,
            declaredUnit,
            gwpDeclared,
            gwpTotal,
            lastUpdated: new Date(),
          };

          try {
            await OkobaudatMaterial.findOneAndUpdate(
              { uuid },
              { $set: materialData },
              { upsert: true }
            );
          } catch {
            // Ignore cache errors
          }

          return this.toSearchResult(materialData);
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(
          ...batchResults.filter(
            (r): r is LcaMaterialSearchResult => r !== null
          )
        );
      }

      // Sort: "Durchschnitt DE" (German average) materials first
      results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aIsDurchschnitt = aName.includes("durchschnitt");
        const bIsDurchschnitt = bName.includes("durchschnitt");
        const aIsDE = aName.includes("de)") || aName.includes("de ");
        const bIsDE = bName.includes("de)") || bName.includes("de ");

        if (aIsDurchschnitt && aIsDE && !(bIsDurchschnitt && bIsDE)) return -1;
        if (bIsDurchschnitt && bIsDE && !(aIsDurchschnitt && aIsDE)) return 1;
        if (aIsDurchschnitt && !bIsDurchschnitt) return -1;
        if (bIsDurchschnitt && !aIsDurchschnitt) return 1;
        return a.name.localeCompare(b.name);
      });

      return results;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        logger.warn("[ÖKOBAUDAT LCA] Search request timed out");
      } else {
        logger.error("[ÖKOBAUDAT LCA] Search error:", error);
      }
      return cachedResults.map((m) => this.toSearchResult(m));
    }
  }

  /**
   * Get a single material by ID
   */
  async getById(id: string): Promise<LcaMaterialData | null> {
    const prefix = "OKOBAU_";
    if (!id.startsWith(prefix)) {
      return null;
    }
    const uuid = id.slice(prefix.length);

    // Check memory cache
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    await connectToDatabase();

    // Check database cache
    const cached = await OkobaudatMaterial.findOne({ uuid }).lean();
    if (cached) {
      const material = this.toUnifiedFormat(cached);
      this.cache.set(id, material);
      return material;
    }

    // Fetch from API
    const epdData = await this.fetchEpdData(uuid);
    if (!epdData) {
      return null;
    }

    const refExchange = this.extractReferenceExchange(epdData);
    if (!refExchange) {
      return null;
    }

    const density = this.extractDensity(refExchange);
    if (!density || density <= 0) {
      throw new Error(`Material ${uuid} has no valid density`);
    }

    const gwpDeclared = this.extractGwpTotal(epdData);
    if (gwpDeclared === null) {
      throw new Error(`Material ${uuid} has no GWP-total in LCIAResults`);
    }

    const declaredUnit = this.extractDeclaredUnit(refExchange);
    const gwpTotal = this.normalizeGwpToPerKg(gwpDeclared, declaredUnit, density);

    if (gwpTotal === null) {
      throw new Error(
        `Cannot normalize GWP from ${declaredUnit} to kg for material ${uuid}`
      );
    }

    const name = this.extractEpdName(epdData);

    const materialData: IOkobaudatMaterial = {
      uuid,
      name,
      nameDE: name,
      density,
      declaredUnit,
      gwpDeclared,
      gwpTotal,
      lastUpdated: new Date(),
    };

    // Cache in database
    try {
      await OkobaudatMaterial.findOneAndUpdate(
        { uuid },
        { $set: materialData },
        { upsert: true }
      );
    } catch {
      // Ignore cache errors
    }

    const material = this.toUnifiedFormat(materialData);
    this.cache.set(id, material);
    return material;
  }

  /**
   * Get all materials from cache
   * Note: ÖKOBAUDAT doesn't have a bulk export endpoint, so we return cached results
   */
  async getAll(): Promise<LcaMaterialData[]> {
    await connectToDatabase();

    const materials = (await OkobaudatMaterial.findValidMaterials().lean()) as unknown as IOkobaudatMaterial[];
    return materials.map((m) => this.toUnifiedFormat(m));
  }

  /**
   * Sync is not fully supported for ÖKOBAUDAT (no bulk export API)
   * This method returns the current cache status
   */
  async sync(): Promise<{ synced: number; errors: number }> {
    logger.info(
      "[ÖKOBAUDAT LCA] ÖKOBAUDAT doesn't support bulk sync - materials are cached on-demand during search"
    );

    await connectToDatabase();
    const count = await OkobaudatMaterial.countDocuments({
      gwpTotal: { $exists: true, $ne: null },
    });

    return { synced: count, errors: 0 };
  }
}

// Singleton instance
let _instance: OkobaudatLcaService | null = null;

export function getOkobaudatLcaService(): OkobaudatLcaService {
  if (!_instance) {
    _instance = new OkobaudatLcaService();
  }
  return _instance;
}
