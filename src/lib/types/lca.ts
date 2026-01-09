/**
 * Types and interfaces for multi-source LCA (Life Cycle Assessment) data
 * Supports KBOB (Switzerland), ÖKOBAUDAT (Germany), and OpenEPD (Global)
 */

/**
 * Supported LCA data sources
 */
export type LcaDataSource = 'kbob' | 'okobaudat' | 'openepd';

/**
 * Available environmental indicators
 */
export type LcaIndicator = 'gwp' | 'ubp' | 'penre';

/**
 * Unified material data structure for all LCA data sources
 * All environmental indicators are normalized to per-kg values
 */
export interface LcaMaterialData {
  // Universal identifiers
  /** Source-prefixed ID: "KBOB_xxx", "OKOBAU_xxx", "OPENEPD_xxx" */
  id: string;
  /** Original ID from source (uuid, etc.) */
  sourceId: string;
  /** Data source identifier */
  source: LcaDataSource;

  // Display information
  /** Primary display name */
  name: string;
  /** German name (if available) */
  nameDE?: string;
  /** French name (if available) */
  nameFR?: string;
  /** Material category/group */
  category?: string;

  // Physical properties
  /** Density in kg/m³ (required for calculations) */
  density: number;
  /** Declared unit from source (m³, kg, m², etc.) */
  declaredUnit: string;

  // Environmental indicators (per kg, normalized)
  /** Global Warming Potential (kg CO₂-eq/kg) - available in all sources */
  gwp: number;
  /** Umweltbelastungspunkte (Swiss ecological scarcity) - KBOB only */
  ubp?: number | null;
  /** Primary Energy Non-Renewable (MJ/kg) */
  penre?: number | null;

  // Metadata
  /** EPD validity date */
  validUntil?: Date;
  /** Data quality indicator */
  dataQuality?: string;
  /** Link to original EPD document */
  epdUrl?: string;
  /** API version or database version */
  version?: string;
  /** Last sync/update timestamp */
  lastUpdated?: Date;
}

/**
 * Material search result for UI display (lightweight version)
 */
export interface LcaMaterialSearchResult {
  id: string;
  sourceId: string;
  source: LcaDataSource;
  name: string;
  nameDE?: string;
  category?: string;
  density: number | null;
  gwp: number | null;
  ubp?: number | null;
  penre?: number | null;
}

/**
 * LCA match stored on a material
 */
export interface LcaMatch {
  /** Data source: kbob, okobaudat, openepd */
  source: LcaDataSource;
  /** Source-prefixed ID (e.g., "KBOB_uuid", "OKOBAU_uuid") */
  materialId: string;
  /** Original source UUID/ID */
  sourceId: string;
  /** Cached material name for display */
  name: string;
  /** When the match was created */
  matchedAt: Date;
  /** Cached indicator values at match time */
  indicators?: {
    gwp: number;
    ubp?: number | null;
    penre?: number | null;
  };
}

/**
 * Service interface for LCA data providers
 */
export interface ILcaDataService {
  /** Data source identifier */
  readonly source: LcaDataSource;
  /** Human-readable display name */
  readonly displayName: string;
  /** Country/region flag for display */
  readonly countryFlag: string;

  /**
   * Search materials by name/query
   * @param query Search term (min 2 characters)
   * @param limit Maximum results (default: 50)
   */
  search(query: string, limit?: number): Promise<LcaMaterialSearchResult[]>;

  /**
   * Get a single material by its source-prefixed ID
   * @param id Material ID (e.g., "KBOB_uuid")
   */
  getById(id: string): Promise<LcaMaterialData | null>;

  /**
   * Get all valid materials from cache/database
   */
  getAll(): Promise<LcaMaterialData[]>;

  /**
   * Sync materials from external API to local cache
   */
  sync(): Promise<{ synced: number; errors: number }>;

  /**
   * Get list of indicators available from this source
   */
  getAvailableIndicators(): LcaIndicator[];

  /**
   * Check if cache needs refresh
   */
  needsRefresh(): Promise<boolean>;
}

/**
 * Metadata about an LCA data source
 */
export interface LcaDataSourceInfo {
  id: LcaDataSource;
  name: string;
  displayName: string;
  countryFlag: string;
  country: string;
  description: string;
  indicators: LcaIndicator[];
  /** Whether API key is required */
  requiresApiKey: boolean;
  /** Whether this source is currently configured/available */
  isConfigured: boolean;
  /** External documentation URL */
  docsUrl?: string;
}

/**
 * Configuration for LCA data sources
 */
export const LCA_SOURCE_CONFIG: Record<LcaDataSource, Omit<LcaDataSourceInfo, 'isConfigured'>> = {
  kbob: {
    id: 'kbob',
    name: 'KBOB',
    displayName: 'KBOB (Switzerland)',
    countryFlag: '🇨🇭',
    country: 'Switzerland',
    description: 'Swiss construction materials database with GWP, UBP (ecological scarcity), and primary energy data.',
    indicators: ['gwp', 'ubp', 'penre'],
    requiresApiKey: true,
    docsUrl: 'https://www.kbob.admin.ch/',
  },
  okobaudat: {
    id: 'okobaudat',
    name: 'ÖKOBAUDAT',
    displayName: 'ÖKOBAUDAT (Germany)',
    countryFlag: '🇩🇪',
    country: 'Germany',
    description: 'German national EPD database for construction products. Free API access.',
    indicators: ['gwp', 'penre'],
    requiresApiKey: false,
    docsUrl: 'https://www.oekobaudat.de/',
  },
  openepd: {
    id: 'openepd',
    name: 'OpenEPD',
    displayName: 'OpenEPD / EC3 (Global)',
    countryFlag: '🌍',
    country: 'Global',
    description: 'Building Transparency EC3 database with global EPD data. Requires free API key.',
    indicators: ['gwp'],
    requiresApiKey: true,
    docsUrl: 'https://docs.open-epd-forum.org/',
  },
};

/**
 * ID prefix constants for each data source
 */
export const LCA_ID_PREFIX: Record<LcaDataSource, string> = {
  kbob: 'KBOB_',
  okobaudat: 'OKOBAU_',
  openepd: 'OPENEPD_',
};

/**
 * Parse a source-prefixed material ID
 * @param materialId e.g., "KBOB_abc-123"
 * @returns { source, sourceId } or null if invalid
 */
export function parseLcaMaterialId(materialId: string): { source: LcaDataSource; sourceId: string } | null {
  for (const [source, prefix] of Object.entries(LCA_ID_PREFIX)) {
    if (materialId.startsWith(prefix)) {
      return {
        source: source as LcaDataSource,
        sourceId: materialId.slice(prefix.length),
      };
    }
  }
  return null;
}

/**
 * Create a source-prefixed material ID
 * @param source Data source
 * @param sourceId Original ID from source
 */
export function createLcaMaterialId(source: LcaDataSource, sourceId: string): string {
  return `${LCA_ID_PREFIX[source]}${sourceId}`;
}
