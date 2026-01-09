/**
 * LCA Service Factory
 * Provides unified access to multiple LCA data sources
 */

import { logger } from "@/lib/logger";
import type {
  ILcaDataService,
  LcaDataSource,
  LcaDataSourceInfo,
  LcaMaterialData,
  LcaMaterialSearchResult,
} from "@/lib/types/lca";
import { LCA_SOURCE_CONFIG, parseLcaMaterialId } from "@/lib/types/lca";
import { KbobLcaService, getKbobLcaService } from "./kbob-lca-service";
import { OkobaudatLcaService, getOkobaudatLcaService } from "./okobaudat-lca-service";
import { OpenEpdLcaService, getOpenEpdLcaService } from "./openepd-lca-service";

/**
 * Get the LCA service for a specific data source
 */
export function getLcaService(source: LcaDataSource): ILcaDataService {
  switch (source) {
    case "kbob":
      return getKbobLcaService();
    case "okobaudat":
      return getOkobaudatLcaService();
    case "openepd":
      return getOpenEpdLcaService();
    default:
      throw new Error(`Unknown LCA data source: ${source}`);
  }
}

/**
 * Get all available LCA services
 */
export function getAllLcaServices(): ILcaDataService[] {
  return [
    getKbobLcaService(),
    getOkobaudatLcaService(),
    getOpenEpdLcaService(),
  ];
}

/**
 * Get information about all available data sources
 */
export function getAvailableSources(): LcaDataSourceInfo[] {
  const sources: LcaDataSourceInfo[] = [];

  // KBOB - check if API key is configured
  const kbobConfigured = Boolean(process.env.KBOB_API_KEY);
  sources.push({
    ...LCA_SOURCE_CONFIG.kbob,
    isConfigured: kbobConfigured,
  });

  // ÖKOBAUDAT - no API key required
  sources.push({
    ...LCA_SOURCE_CONFIG.okobaudat,
    isConfigured: true, // Always available (free API)
  });

  // OpenEPD - check if API key is configured
  const openEpdConfigured = Boolean(process.env.OPENEPD_API_KEY);
  sources.push({
    ...LCA_SOURCE_CONFIG.openepd,
    isConfigured: openEpdConfigured,
  });

  return sources;
}

/**
 * Get a material by its source-prefixed ID (auto-detects source)
 */
export async function getMaterialById(
  materialId: string
): Promise<LcaMaterialData | null> {
  const parsed = parseLcaMaterialId(materialId);
  if (!parsed) {
    logger.warn(`[LCA Factory] Invalid material ID format: ${materialId}`);
    return null;
  }

  const service = getLcaService(parsed.source);
  return service.getById(materialId);
}

/**
 * Search across all configured data sources
 */
export async function searchAllSources(
  query: string,
  limit: number = 20
): Promise<LcaMaterialSearchResult[]> {
  const sources = getAvailableSources().filter((s) => s.isConfigured);
  const perSourceLimit = Math.ceil(limit / sources.length);

  const searchPromises = sources.map(async (sourceInfo) => {
    try {
      const service = getLcaService(sourceInfo.id);
      return await service.search(query, perSourceLimit);
    } catch (error) {
      logger.error(
        `[LCA Factory] Search error for ${sourceInfo.id}:`,
        error
      );
      return [];
    }
  });

  const results = await Promise.all(searchPromises);
  const combined = results.flat();

  // Sort by source priority (KBOB first, then ÖKOBAUDAT, then OpenEPD)
  const sourcePriority: Record<LcaDataSource, number> = {
    kbob: 0,
    okobaudat: 1,
    openepd: 2,
  };

  combined.sort((a, b) => {
    const priorityDiff = sourcePriority[a.source] - sourcePriority[b.source];
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name);
  });

  return combined.slice(0, limit);
}

/**
 * Sync all configured data sources
 */
export async function syncAllSources(): Promise<
  Record<LcaDataSource, { synced: number; errors: number }>
> {
  const results: Record<LcaDataSource, { synced: number; errors: number }> = {
    kbob: { synced: 0, errors: 0 },
    okobaudat: { synced: 0, errors: 0 },
    openepd: { synced: 0, errors: 0 },
  };

  const sources = getAvailableSources().filter((s) => s.isConfigured);

  for (const sourceInfo of sources) {
    try {
      const service = getLcaService(sourceInfo.id);
      results[sourceInfo.id] = await service.sync();
      logger.info(
        `[LCA Factory] ${sourceInfo.name} sync: ${results[sourceInfo.id].synced} materials`
      );
    } catch (error) {
      logger.error(`[LCA Factory] Sync error for ${sourceInfo.id}:`, error);
      results[sourceInfo.id] = { synced: 0, errors: 1 };
    }
  }

  return results;
}

/**
 * Get default LCA source based on configuration
 * Returns the first configured source (priority: KBOB > ÖKOBAUDAT > OpenEPD)
 */
export function getDefaultSource(): LcaDataSource {
  if (process.env.KBOB_API_KEY) {
    return "kbob";
  }
  // ÖKOBAUDAT is always available
  return "okobaudat";
}
