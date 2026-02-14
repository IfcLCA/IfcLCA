/**
 * Ökobaudat data source adapter.
 *
 * Connects to the German Ökobaudat ILCD+EPD API and normalizes
 * materials into the generic NormalizedMaterial format.
 *
 * API docs: https://oekobaudat.de/en/guidance/software-developers.html
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
// Ökobaudat API types (source-specific)
// ---------------------------------------------------------------------------

/** Simplified representation of an ILCD+EPD process dataset */
interface OekobaudatProcess {
  uuid: string;
  name: string;
  classificationInformation?: {
    classification?: Array<{
      class?: Array<{ value: string; level: number }>;
    }>;
  };
  lciMethodAndAllocation?: {
    typeOfDataSet?: string;
  };
  /** Environmental indicators from the LCIA results */
  lciaResults?: Array<{
    method: { uuid: string; name: string };
    /** Module indicator values (A1-A3, B1-B7, C1-C4, D) */
    amounts?: Array<{
      module: string;
      value: number;
    }>;
  }>;
  /** Technical flow properties for density etc. */
  flowProperties?: Array<{
    name: string;
    meanValue: number;
    unit: string;
  }>;
}

interface OekobaudatListResponse {
  data: Array<{
    uuid: string;
    name: string;
    classification?: string;
  }>;
  totalCount: number;
  pageSize: number;
  pageNumber: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OEKOBAUDAT_SOURCE_ID = "oekobaudat";

/** Well-known LCIA method UUIDs in Ökobaudat (EN 15804+A2) */
const LCIA_METHOD_UUIDS: Record<string, IndicatorKey> = {
  "77e416eb-a363-4258-a04e-171d843a6460": "gwpTotal",
  "06dcd26f-025f-401a-a7c1-5e457eb54637": "gwpFossil",
  "f0e10c0d-47a7-4834-8730-3791b0e7fa44": "gwpBiogenic",
  "1b321880-abef-4fa6-8e2e-a81e2a385165": "gwpLuluc",
  "804ebede-a544-4d93-b3a0-6cf4d1f4f7c2": "penreTotal",
  "20f32be2-61a2-4856-85b1-2e3348cdc44c": "pereTotal",
  "b5c63067-53a0-45a4-8a32-6cfc1b7d7c10": "ap",
  "7fa1de06-7340-475f-8b8f-adf37ab446d7": "odp",
  "96215749-760c-4595-9e51-7b5462eb33a3": "pocp",
  "f7c73bb9-ab1a-4249-9c6d-379a0de6f67e": "adpMineral",
  "804ebede-a544-4d93-b3a0-6cf4d1f4f7c3": "adpFossil",
};

const OEKOBAUDAT_INFO: DataSourceInfo = {
  id: OEKOBAUDAT_SOURCE_ID,
  name: "Ökobaudat",
  region: "DE",
  url: "https://oekobaudat.de",
  description:
    "German construction materials database with full EN 15804+A2 indicators including all GWP variants, acidification, ozone depletion, and more.",
  availableIndicators: [
    "gwpTotal",
    "gwpFossil",
    "gwpBiogenic",
    "gwpLuluc",
    "penreTotal",
    "pereTotal",
    "ap",
    "odp",
    "pocp",
    "adpMineral",
    "adpFossil",
  ] as IndicatorKey[],
  requiresAuth: false,
};

const SYNC_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractIndicators(
  lciaResults?: OekobaudatProcess["lciaResults"]
): Record<string, number | null> {
  const indicators: Record<string, number | null> = {};

  if (!lciaResults) return indicators;

  for (const result of lciaResults) {
    const indicatorKey = LCIA_METHOD_UUIDS[result.method.uuid];
    if (!indicatorKey) continue;

    // Sum A1-A3 modules for production stage
    const a1a3Value =
      result.amounts
        ?.filter((a) => ["A1", "A2", "A3", "A1-A3"].includes(a.module))
        .reduce((sum, a) => sum + a.value, 0) ?? null;

    indicators[indicatorKey] = a1a3Value;
  }

  return indicators;
}

function extractDensity(
  flowProps?: OekobaudatProcess["flowProperties"]
): number | null {
  if (!flowProps) return null;
  const densityProp = flowProps.find(
    (fp) =>
      fp.name.toLowerCase().includes("density") ||
      fp.name.toLowerCase().includes("rohdichte")
  );
  return densityProp?.meanValue ?? null;
}

function extractCategory(proc: OekobaudatProcess): string {
  const classes =
    proc.classificationInformation?.classification?.[0]?.class ?? [];
  if (classes.length === 0) return "Uncategorized";
  // Take the most specific (highest level) class
  const sorted = [...classes].sort((a, b) => b.level - a.level);
  return sorted[0]?.value ?? "Uncategorized";
}

function normalizeOekobaudatProcess(
  proc: OekobaudatProcess
): NormalizedMaterial {
  return {
    id: "",
    sourceId: proc.uuid,
    source: OEKOBAUDAT_SOURCE_ID,
    name: proc.name,
    nameOriginal: proc.name,
    category: extractCategory(proc),
    density: extractDensity(proc.flowProperties),
    unit: "kg",
    indicators: extractIndicators(proc.lciaResults),
    metadata: {
      version: "current",
      lastSynced: new Date(),
      scope: "A1-A3",
      standard: "EN 15804+A2",
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class OekobaudatAdapter implements LCADataSourceAdapter {
  info = OEKOBAUDAT_INFO;

  private get apiUrl(): string {
    return (
      process.env.OEKOBAUDAT_API_URL ||
      "https://oekobaudat.de/OEKOBAU.DAT/resource"
    );
  }

  private get datastockId(): string {
    return (
      process.env.OEKOBAUDAT_DATASTOCK_ID ||
      "cd2bda71-760b-4fcc-8a0b-3877c10000a8"
    );
  }

  async fetchAll(): Promise<NormalizedMaterial[]> {
    // Ökobaudat requires paginated fetching — first get the list,
    // then fetch details for each process.
    const listUrl = `${this.apiUrl}/datastocks/${this.datastockId}/processes?format=json&pageSize=500`;
    const allMaterials: NormalizedMaterial[] = [];
    let pageNumber = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${listUrl}&startIndex=${pageNumber * 500}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(60_000),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Ökobaudat API error: ${response.status} ${response.statusText}`
        );
      }

      const data: OekobaudatListResponse = await response.json();

      // For the list endpoint, we get summary data.
      // Full indicator data requires fetching each process individually.
      // For sync, we fetch details in batches.
      for (const item of data.data) {
        const detail = await this.fetchProcessDetail(item.uuid);
        if (detail) {
          allMaterials.push(normalizeOekobaudatProcess(detail));
        }
      }

      hasMore = data.data.length === 500;
      pageNumber++;
    }

    return allMaterials;
  }

  private async fetchProcessDetail(
    uuid: string
  ): Promise<OekobaudatProcess | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}/datastocks/${this.datastockId}/processes/${uuid}?format=json&view=extended`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!response.ok) return null;
      return (await response.json()) as OekobaudatProcess;
    } catch {
      return null;
    }
  }

  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<NormalizedMaterial[]> {
    await connectDB();

    const dbQuery: Record<string, unknown> = {
      source: OEKOBAUDAT_SOURCE_ID,
    };

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
      source: OEKOBAUDAT_SOURCE_ID,
      sourceId,
    }).lean();
    return doc ? docToNormalized(doc) : null;
  }

  async getLastSyncTime(): Promise<Date | null> {
    await connectDB();
    const latest = await LCASourceModel.findOne({
      source: OEKOBAUDAT_SOURCE_ID,
    })
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

    for (let i = 0; i < materials.length; i += SYNC_BATCH_SIZE) {
      const batch = materials.slice(i, i + SYNC_BATCH_SIZE);
      const ops = batch.map((m) => ({
        updateOne: {
          filter: { source: OEKOBAUDAT_SOURCE_ID, sourceId: m.sourceId },
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
