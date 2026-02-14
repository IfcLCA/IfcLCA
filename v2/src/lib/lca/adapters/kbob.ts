/**
 * KBOB data source adapter.
 *
 * Connects to the Swiss lcadata.ch API and normalizes KBOB materials
 * into the generic NormalizedMaterial format. Persists to Turso via Drizzle.
 */

import { eq, and, like, gte, lte, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { lcaMaterials } from "@/db/schema";
import type {
  LCADataSourceAdapter,
  DataSourceInfo,
  NormalizedMaterial,
  SearchFilters,
  SyncResult,
  IndicatorKey,
} from "@/types/lca";

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

const SOURCE_ID = "kbob";

const INFO: DataSourceInfo = {
  id: SOURCE_ID,
  name: "KBOB",
  region: "CH",
  url: "https://www.lcadata.ch",
  description:
    "Swiss KBOB construction materials database with GWP, UBP, and primary energy indicators.",
  availableIndicators: ["gwpTotal", "penreTotal", "ubp"] as IndicatorKey[],
  requiresAuth: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKbobDensity(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw > 0 ? raw : null;
  const parsed = parseFloat(raw);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

function isValidKbobMaterial(m: KbobApiMaterial): boolean {
  const hasIndicators =
    m.gwpTotal != null &&
    m.ubp21Total != null &&
    m.primaryEnergyNonRenewableTotal != null;

  if (!hasIndicators) return false;

  const hasNonZero =
    (m.gwpTotal ?? 0) !== 0 ||
    (m.ubp21Total ?? 0) !== 0 ||
    (m.primaryEnergyNonRenewableTotal ?? 0) !== 0;

  return hasNonZero && parseKbobDensity(m.density) !== null;
}

function normalizeApiMaterial(
  api: KbobApiMaterial,
  version: string
): NormalizedMaterial {
  return {
    id: "",
    sourceId: api.uuid,
    source: SOURCE_ID,
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

/** Convert a Drizzle row to NormalizedMaterial */
function rowToNormalized(row: typeof lcaMaterials.$inferSelect): NormalizedMaterial {
  return {
    id: row.id,
    sourceId: row.sourceId,
    source: row.source,
    name: row.name,
    nameOriginal: row.nameOriginal ?? undefined,
    category: row.category ?? "Uncategorized",
    categoryOriginal: row.categoryOriginal ?? undefined,
    density: row.density,
    unit: row.unit ?? "kg",
    indicators: {
      gwpTotal: row.gwpTotal,
      penreTotal: row.penreTotal,
      ubp: row.ubp,
    },
    metadata: {
      version: row.version ?? "unknown",
      lastSynced: row.lastSynced,
      validUntil: row.validUntil ?? undefined,
      scope: row.scope ?? undefined,
      standard: row.standard ?? undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class KBOBAdapter implements LCADataSourceAdapter {
  info = INFO;

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
      throw new Error(
        `KBOB API error: ${response.status} ${response.statusText}`
      );
    }

    const data: KbobApiResponse = await response.json();
    const version = data.version || "unknown";

    return data.materials
      .filter(isValidKbobMaterial)
      .map((m) => normalizeApiMaterial(m, version));
  }

  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<NormalizedMaterial[]> {
    const conditions = [eq(lcaMaterials.source, SOURCE_ID)];

    if (query) {
      conditions.push(like(lcaMaterials.name, `%${query}%`));
    }
    if (filters?.category) {
      conditions.push(eq(lcaMaterials.category, filters.category));
    }
    if (filters?.minDensity !== undefined) {
      conditions.push(gte(lcaMaterials.density, filters.minDensity));
    }
    if (filters?.maxDensity !== undefined) {
      conditions.push(lte(lcaMaterials.density, filters.maxDensity));
    }

    const rows = await db
      .select()
      .from(lcaMaterials)
      .where(and(...conditions))
      .limit(50);

    return rows.map(rowToNormalized);
  }

  async getById(sourceId: string): Promise<NormalizedMaterial | null> {
    const [row] = await db
      .select()
      .from(lcaMaterials)
      .where(
        and(eq(lcaMaterials.source, SOURCE_ID), eq(lcaMaterials.sourceId, sourceId))
      )
      .limit(1);

    return row ? rowToNormalized(row) : null;
  }

  async getLastSyncTime(): Promise<Date | null> {
    const [row] = await db
      .select({ lastSynced: lcaMaterials.lastSynced })
      .from(lcaMaterials)
      .where(eq(lcaMaterials.source, SOURCE_ID))
      .orderBy(desc(lcaMaterials.lastSynced))
      .limit(1);

    return row?.lastSynced ?? null;
  }

  async sync(): Promise<SyncResult> {
    const materials = await this.fetchAll();
    const result: SyncResult = {
      added: 0,
      updated: 0,
      removed: 0,
      errors: [],
      timestamp: new Date(),
    };

    // Batch insert with ON CONFLICT UPDATE (50x faster than row-by-row)
    const BATCH_SIZE = 100;
    for (let i = 0; i < materials.length; i += BATCH_SIZE) {
      const batch = materials.slice(i, i + BATCH_SIZE);

      try {
        const rows = batch.map((m) => ({
          id: nanoid(),
          source: SOURCE_ID,
          sourceId: m.sourceId,
          name: m.name,
          nameOriginal: m.nameOriginal,
          category: m.category,
          categoryOriginal: m.categoryOriginal,
          density: m.density,
          unit: m.unit,
          gwpTotal: m.indicators.gwpTotal ?? null,
          penreTotal: m.indicators.penreTotal ?? null,
          ubp: m.indicators.ubp ?? null,
          version: m.metadata.version,
          lastSynced: new Date(),
          scope: m.metadata.scope,
          standard: m.metadata.standard,
        }));

        await db
          .insert(lcaMaterials)
          .values(rows)
          .onConflictDoUpdate({
            target: [lcaMaterials.source, lcaMaterials.sourceId],
            set: {
              name: sql`excluded.name`,
              nameOriginal: sql`excluded.name_original`,
              category: sql`excluded.category`,
              categoryOriginal: sql`excluded.category_original`,
              density: sql`excluded.density`,
              unit: sql`excluded.unit`,
              gwpTotal: sql`excluded.gwp_total`,
              penreTotal: sql`excluded.penre_total`,
              ubp: sql`excluded.ubp`,
              version: sql`excluded.version`,
              lastSynced: sql`excluded.last_synced`,
              scope: sql`excluded.scope`,
              standard: sql`excluded.standard`,
              updatedAt: new Date(),
            },
          });

        result.added += batch.length; // Approximate (includes updates)
      } catch (err) {
        result.errors.push(
          `Batch ${i}-${i + BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }
}
