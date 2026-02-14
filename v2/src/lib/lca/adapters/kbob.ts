/**
 * KBOB data source adapter.
 *
 * Connects to the Swiss lcadata.ch API and normalizes KBOB materials
 * into the generic NormalizedMaterial format.
 */

import type {
  LCADataSourceAdapter,
  DataSourceInfo,
  NormalizedMaterial,
  SearchFilters,
  SyncResult,
  IndicatorKey,
} from "@/types/lca";
import { LCASourceModel } from "@/lib/db/models/lca-source";
import { connectDB } from "@/lib/db/connect";

// ---------------------------------------------------------------------------
// KBOB API types (source-specific, not exported)
// ---------------------------------------------------------------------------

interface KbobApiResponse {
  success: boolean;
  version: string;
  materials: KbobApiMaterial[];
  count: number;
  totalMaterials: number;
}

interface KbobApiMaterial {
  uuid: string;
  nameDE: string;
  nameFR: string;
  group: string;
  density: string | number | null;
  unit: string;
  ubp21Total: number | null;
  gwpTotal: number | null;
  primaryEnergyNonRenewableTotal: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KBOB_SOURCE_ID = "kbob";

const KBOB_INFO: DataSourceInfo = {
  id: KBOB_SOURCE_ID,
  name: "KBOB",
  region: "CH",
  url: "https://www.lcadata.ch",
  description:
    "Swiss KBOB construction materials database with GWP, UBP, and primary energy indicators.",
  availableIndicators: ["gwpTotal", "penreTotal", "ubp"] as IndicatorKey[],
  requiresAuth: true,
};

const SYNC_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKbobDensity(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw > 0 ? raw : null;
  const parsed = parseFloat(raw);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

function normalizeKbobMaterial(
  api: KbobApiMaterial,
  version: string
): NormalizedMaterial {
  return {
    id: "", // Set by the DB layer on insert
    sourceId: api.uuid,
    source: KBOB_SOURCE_ID,
    name: api.nameDE,
    nameOriginal: api.nameDE,
    category: api.group || "Uncategorized",
    categoryOriginal: api.group,
    density: parseKbobDensity(api.density),
    unit: api.unit || "kg",
    indicators: {
      gwpTotal: api.gwpTotal ?? null,
      penreTotal: api.primaryEnergyNonRenewableTotal ?? null,
      ubp: api.ubp21Total ?? null,
    },
    metadata: {
      version,
      lastSynced: new Date(),
      scope: "A1-A3",
      standard: "KBOB/ecobau/IPB",
    },
  };
}

function isValidKbobMaterial(m: KbobApiMaterial): boolean {
  const hasIndicators =
    m.gwpTotal !== null &&
    m.gwpTotal !== undefined &&
    m.ubp21Total !== null &&
    m.ubp21Total !== undefined &&
    m.primaryEnergyNonRenewableTotal !== null &&
    m.primaryEnergyNonRenewableTotal !== undefined;

  if (!hasIndicators) return false;

  const hasNonZero =
    (m.gwpTotal ?? 0) !== 0 ||
    (m.ubp21Total ?? 0) !== 0 ||
    (m.primaryEnergyNonRenewableTotal ?? 0) !== 0;

  const hasDensity = parseKbobDensity(m.density) !== null;

  return hasNonZero && hasDensity;
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class KBOBAdapter implements LCADataSourceAdapter {
  info = KBOB_INFO;

  private get apiUrl(): string {
    return process.env.KBOB_API_URL || "https://www.lcadata.ch";
  }

  private get apiKey(): string {
    const key = process.env.KBOB_API_KEY;
    if (!key) throw new Error("KBOB_API_KEY environment variable is required");
    return key;
  }

  async fetchAll(): Promise<NormalizedMaterial[]> {
    const response = await fetch(
      `${this.apiUrl}/api/kbob/materials?pageSize=all`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!response.ok) {
      throw new Error(`KBOB API error: ${response.status} ${response.statusText}`);
    }

    const data: KbobApiResponse = await response.json();
    const version = data.version || "unknown";

    return data.materials
      .filter(isValidKbobMaterial)
      .map((m) => normalizeKbobMaterial(m, version));
  }

  async search(query: string, filters?: SearchFilters): Promise<NormalizedMaterial[]> {
    await connectDB();

    const dbQuery: Record<string, unknown> = { source: KBOB_SOURCE_ID };

    if (query) {
      dbQuery.$text = { $search: query };
    }

    if (filters?.category) {
      dbQuery.category = filters.category;
    }

    if (filters?.minDensity !== undefined || filters?.maxDensity !== undefined) {
      dbQuery.density = {};
      if (filters.minDensity !== undefined) {
        (dbQuery.density as Record<string, number>).$gte = filters.minDensity;
      }
      if (filters.maxDensity !== undefined) {
        (dbQuery.density as Record<string, number>).$lte = filters.maxDensity;
      }
    }

    const docs = await LCASourceModel.find(dbQuery).limit(50).lean();
    return docs.map(docToNormalized);
  }

  async getById(sourceId: string): Promise<NormalizedMaterial | null> {
    await connectDB();
    const doc = await LCASourceModel.findOne({
      source: KBOB_SOURCE_ID,
      sourceId,
    }).lean();
    return doc ? docToNormalized(doc) : null;
  }

  async getLastSyncTime(): Promise<Date | null> {
    await connectDB();
    const latest = await LCASourceModel.findOne({ source: KBOB_SOURCE_ID })
      .sort({ "metadata.lastSynced": -1 })
      .select("metadata.lastSynced")
      .lean();
    return latest?.metadata?.lastSynced ?? null;
  }

  async sync(): Promise<SyncResult> {
    await connectDB();

    const materials = await this.fetchAll();
    const result: SyncResult = {
      added: 0,
      updated: 0,
      removed: 0,
      errors: [],
      timestamp: new Date(),
    };

    // Process in batches
    for (let i = 0; i < materials.length; i += SYNC_BATCH_SIZE) {
      const batch = materials.slice(i, i + SYNC_BATCH_SIZE);
      const ops = batch.map((m) => ({
        updateOne: {
          filter: { source: KBOB_SOURCE_ID, sourceId: m.sourceId },
          update: {
            $set: {
              name: m.name,
              nameOriginal: m.nameOriginal,
              category: m.category,
              categoryOriginal: m.categoryOriginal,
              density: m.density,
              unit: m.unit,
              indicators: m.indicators,
              metadata: m.metadata,
            },
            $setOnInsert: {
              source: m.source,
              sourceId: m.sourceId,
            },
          },
          upsert: true,
        },
      }));

      try {
        const bulkResult = await LCASourceModel.bulkWrite(ops);
        result.added += bulkResult.upsertedCount;
        result.updated += bulkResult.modifiedCount;
      } catch (err) {
        result.errors.push(
          `Batch ${i}-${i + SYNC_BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// DB document → NormalizedMaterial
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToNormalized(doc: any): NormalizedMaterial {
  return {
    id: doc._id.toString(),
    sourceId: doc.sourceId,
    source: doc.source,
    name: doc.name,
    nameOriginal: doc.nameOriginal,
    category: doc.category,
    categoryOriginal: doc.categoryOriginal,
    density: doc.density,
    unit: doc.unit,
    indicators: doc.indicators ?? {},
    metadata: {
      version: doc.metadata?.version ?? "unknown",
      lastSynced: doc.metadata?.lastSynced ?? new Date(),
      validUntil: doc.metadata?.validUntil,
      scope: doc.metadata?.scope,
      standard: doc.metadata?.standard,
    },
  };
}
