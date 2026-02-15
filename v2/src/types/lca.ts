/**
 * Core LCA type system — database-agnostic, EN 15804 aligned.
 *
 * All data source adapters normalize their output to these types.
 * The application layer ONLY works with these types, never with
 * source-specific schemas.
 */

// ---------------------------------------------------------------------------
// Environmental indicators (EN 15804+A2)
// ---------------------------------------------------------------------------

/** All possible indicator keys. "Core" indicators are always present. */
export type IndicatorKey =
  // Core — every source must provide at least gwpTotal
  | "gwpTotal"
  | "penreTotal"
  // GWP variants (Ökobaudat, INIES provide these)
  | "gwpFossil"
  | "gwpBiogenic"
  | "gwpLuluc"
  // Energy
  | "pereTotal"
  // EN 15804 impact categories
  | "ap"
  | "odp"
  | "pocp"
  | "adpMineral"
  | "adpFossil"
  // Swiss-specific
  | "ubp";

/** Human-readable metadata for each indicator */
export interface IndicatorMeta {
  key: IndicatorKey;
  name: string;
  unit: string;
  description: string;
  /** Whether this is a "core" indicator shown by default */
  core: boolean;
}

/** Registry of all known indicators and their units */
export const INDICATOR_REGISTRY: Record<IndicatorKey, IndicatorMeta> = {
  gwpTotal: {
    key: "gwpTotal",
    name: "GWP Total",
    unit: "kg CO₂-eq",
    description: "Global Warming Potential (total)",
    core: true,
  },
  gwpFossil: {
    key: "gwpFossil",
    name: "GWP Fossil",
    unit: "kg CO₂-eq",
    description: "Global Warming Potential (fossil)",
    core: false,
  },
  gwpBiogenic: {
    key: "gwpBiogenic",
    name: "GWP Biogenic",
    unit: "kg CO₂-eq",
    description: "Global Warming Potential (biogenic)",
    core: false,
  },
  gwpLuluc: {
    key: "gwpLuluc",
    name: "GWP LULUC",
    unit: "kg CO₂-eq",
    description: "Global Warming Potential (land use)",
    core: false,
  },
  penreTotal: {
    key: "penreTotal",
    name: "PENRE",
    unit: "MJ",
    description: "Primary energy, non-renewable (total)",
    core: true,
  },
  pereTotal: {
    key: "pereTotal",
    name: "PERE",
    unit: "MJ",
    description: "Primary energy, renewable (total)",
    core: false,
  },
  ap: {
    key: "ap",
    name: "AP",
    unit: "mol H⁺-eq",
    description: "Acidification potential",
    core: false,
  },
  odp: {
    key: "odp",
    name: "ODP",
    unit: "kg CFC-11-eq",
    description: "Ozone depletion potential",
    core: false,
  },
  pocp: {
    key: "pocp",
    name: "POCP",
    unit: "kg NMVOC-eq",
    description: "Photochemical ozone creation potential",
    core: false,
  },
  adpMineral: {
    key: "adpMineral",
    name: "ADP Mineral",
    unit: "kg Sb-eq",
    description: "Abiotic depletion, minerals & metals",
    core: false,
  },
  adpFossil: {
    key: "adpFossil",
    name: "ADP Fossil",
    unit: "MJ",
    description: "Abiotic depletion, fossil fuels",
    core: false,
  },
  ubp: {
    key: "ubp",
    name: "UBP",
    unit: "UBP",
    description: "Umweltbelastungspunkte (Swiss eco-points)",
    core: false,
  },
};

/** A set of indicator values. Keys are IndicatorKey, values are numbers or null. */
export type IndicatorValues = Partial<Record<IndicatorKey, number | null>>;

// ---------------------------------------------------------------------------
// Normalized material (the ONE type the app works with)
// ---------------------------------------------------------------------------

export interface NormalizedMaterial {
  /** Internal unique ID (generated on ingest/sync) */
  id: string;

  /** ID in the source database (e.g., KBOB uuid) */
  sourceId: string;

  /** Which data source this came from */
  source: string;

  /** Display name (localized to user preference or source default) */
  name: string;

  /** Name in original source language (if different from `name`) */
  nameOriginal?: string;

  /** Normalized material category */
  category: string;

  /** Category in the source's own classification system */
  categoryOriginal?: string;

  /** Density in kg/m³, or null if unknown */
  density: number | null;

  /** Reference unit (e.g., "kg", "m³", "m²") */
  unit: string;

  /** Environmental indicator values */
  indicators: IndicatorValues;

  /** Source metadata */
  metadata: {
    /** Version of the source database */
    version: string;
    /** When this record was last synced from source */
    lastSynced: Date;
    /** When this EPD/record expires (if applicable) */
    validUntil?: Date;
    /** Life cycle scope (e.g., "A1-A3", "A1-D") */
    scope?: string;
    /** Standard this data conforms to */
    standard?: string;
  };
}

// ---------------------------------------------------------------------------
// Data source adapter interface
// ---------------------------------------------------------------------------

export interface DataSourceInfo {
  /** Unique identifier: "kbob", "oekobaudat", "inies", etc. */
  id: string;
  /** Human-readable name */
  name: string;
  /** ISO 3166-1 alpha-2 country/region code */
  region: string;
  /** Website URL */
  url: string;
  /** Description of the data source */
  description: string;
  /** Which indicators this source provides */
  availableIndicators: IndicatorKey[];
  /** Whether the source requires authentication */
  requiresAuth: boolean;
}

export interface SearchFilters {
  category?: string;
  minDensity?: number;
  maxDensity?: number;
  /** Only return materials that have these indicators */
  hasIndicators?: IndicatorKey[];
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
  timestamp: Date;
}

/**
 * Adapter interface that each LCA data source must implement.
 *
 * Adapters are responsible for:
 * 1. Fetching data from their source API
 * 2. Normalizing it into NormalizedMaterial[]
 * 3. Reporting what indicators they support
 */
export interface LCADataSourceAdapter {
  /** Static info about this data source */
  info: DataSourceInfo;

  /** Fetch all materials (used for full sync) */
  fetchAll(): Promise<NormalizedMaterial[]>;

  /** Search materials by text query + optional filters */
  search(query: string, filters?: SearchFilters): Promise<NormalizedMaterial[]>;

  /** Get a single material by its source-specific ID */
  getById(sourceId: string): Promise<NormalizedMaterial | null>;

  /** Get the last time this source was synced */
  getLastSyncTime(): Promise<Date | null>;

  /** Perform a full sync from source → local cache */
  sync(): Promise<SyncResult>;
}

// ---------------------------------------------------------------------------
// Material matching
// ---------------------------------------------------------------------------

export type MatchMethod =
  | "exact"
  | "case_insensitive"
  | "fuzzy"
  | "classification"
  | "manual"       // User explicitly picked this match (highest confidence)
  | "reapplied"    // Auto-applied from a previous manual mapping of same material name
  | "auto";        // Matched by algorithm (lowest confidence)

export interface MaterialMatch {
  /** Reference to the normalized LCA material */
  lcaMaterialId: string;
  /** Source database ID */
  sourceId: string;
  /** Which data source */
  source: string;
  /** Confidence score 0-1 */
  score: number;
  /** How the match was made */
  method: MatchMethod;
  /** When the match was established */
  matchedAt: Date;
}

// ---------------------------------------------------------------------------
// Project-level types
// ---------------------------------------------------------------------------

export interface ProjectEmissions {
  /** Aggregated indicator totals for the entire project */
  totals: IndicatorValues;
  /** Breakdown by material category (eBKP-H code → indicators) */
  byCategory: Record<string, IndicatorValues>;
  /** Breakdown by element type (IfcWall, IfcSlab, etc.) */
  byElementType: Record<string, IndicatorValues>;
  /** When these were last calculated */
  lastCalculated: Date;
}

// ---------------------------------------------------------------------------
// Viewer / UI types
// ---------------------------------------------------------------------------

export type ColorMode =
  | "none"
  | "matchStatus"
  | "gwpTotal"
  | "penreTotal"
  | "ubp"
  | "elementType"
  | "dataSource";

export interface MatchStatusColor {
  matched: string;
  partial: string;
  unmatched: string;
}
