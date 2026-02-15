/**
 * Ökobaudat data source adapter.
 *
 * Connects to the German Ökobaudat ILCD+EPD API and normalizes
 * materials into the generic NormalizedMaterial format.
 */

import { eq, and, or, like, gte, lte, desc, sql } from "drizzle-orm";
import {
  cleanIfcQuery,
  extractOekobaudatSearchTerms,
} from "@/lib/lca/preprocessing";
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
// Ökobaudat API types
// ---------------------------------------------------------------------------

interface OekobaudatProcess {
  uuid: string;
  name: string;
  classificationInformation?: {
    classification?: Array<{
      class?: Array<{ value: string; level: number }>;
    }>;
  };
  lciaResults?: Array<{
    method: { uuid: string; name: string };
    amounts?: Array<{ module: string; value: number }>;
  }>;
  flowProperties?: Array<{
    name: string;
    meanValue: number;
    unit: string;
  }>;
}

interface OekobaudatListResponse {
  data: Array<{ uuid: string; name: string; classification?: string }>;
  totalCount: number;
  pageSize: number;
  pageNumber: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_ID = "oekobaudat";

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

const INFO: DataSourceInfo = {
  id: SOURCE_ID,
  name: "Ökobaudat",
  region: "DE",
  url: "https://oekobaudat.de",
  description:
    "German construction materials database with full EN 15804+A2 indicators.",
  availableIndicators: [
    "gwpTotal", "gwpFossil", "gwpBiogenic", "gwpLuluc",
    "penreTotal", "pereTotal", "ap", "odp", "pocp",
    "adpMineral", "adpFossil",
  ] as IndicatorKey[],
  requiresAuth: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractIndicators(
  lciaResults?: OekobaudatProcess["lciaResults"]
): Record<string, number | null> {
  const indicators: Record<string, number | null> = {};
  if (!lciaResults) return indicators;

  for (const result of lciaResults) {
    const key = LCIA_METHOD_UUIDS[result.method.uuid];
    if (!key) continue;
    const a1a3 =
      result.amounts
        ?.filter((a) => ["A1", "A2", "A3", "A1-A3"].includes(a.module))
        .reduce((sum, a) => sum + a.value, 0) ?? null;
    indicators[key] = a1a3;
  }
  return indicators;
}

function extractDensity(
  flowProps?: OekobaudatProcess["flowProperties"]
): number | null {
  if (!flowProps) return null;
  const prop = flowProps.find(
    (fp) =>
      fp.name.toLowerCase().includes("density") ||
      fp.name.toLowerCase().includes("rohdichte")
  );
  return prop?.meanValue ?? null;
}

function extractCategory(proc: OekobaudatProcess): string {
  const classes =
    proc.classificationInformation?.classification?.[0]?.class ?? [];
  if (classes.length === 0) return "Uncategorized";
  const sorted = [...classes].sort((a, b) => b.level - a.level);
  return sorted[0]?.value ?? "Uncategorized";
}

function normalizeProcess(proc: OekobaudatProcess): NormalizedMaterial {
  return {
    id: "",
    sourceId: proc.uuid,
    source: SOURCE_ID,
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

function rowToNormalized(
  row: typeof lcaMaterials.$inferSelect
): NormalizedMaterial {
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
      gwpFossil: row.gwpFossil,
      gwpBiogenic: row.gwpBiogenic,
      gwpLuluc: row.gwpLuluc,
      penreTotal: row.penreTotal,
      pereTotal: row.pereTotal,
      ap: row.ap,
      odp: row.odp,
      pocp: row.pocp,
      adpMineral: row.adpMineral,
      adpFossil: row.adpFossil,
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

export class OekobaudatAdapter implements LCADataSourceAdapter {
  info = INFO;

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
    const listUrl = `${this.apiUrl}/datastocks/${this.datastockId}/processes?format=json&pageSize=500`;
    const allMaterials: NormalizedMaterial[] = [];
    let pageNumber = 0;
    let hasMore = true;

    while (hasMore) {
      let response: Response;
      try {
        response = await fetch(
          `${listUrl}&startIndex=${pageNumber * 500}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(60_000),
          }
        );
      } catch (err) {
        console.error(`[oekobaudat] List fetch failed (page ${pageNumber}):`, err);
        break;
      }

      if (!response.ok) {
        console.error(`[oekobaudat] API error: ${response.status} ${response.statusText}`);
        break;
      }

      // Validate response is JSON before parsing
      const contentType = response.headers.get("content-type") ?? "";
      let data: OekobaudatListResponse;
      try {
        const text = await response.text();
        if (!contentType.includes("json") && !text.startsWith("{") && !text.startsWith("[")) {
          console.error("[oekobaudat] List response is not JSON:", text.slice(0, 200));
          break;
        }
        data = JSON.parse(text);
      } catch (err) {
        console.error("[oekobaudat] Failed to parse list JSON:", err);
        break;
      }

      if (!data.data || !Array.isArray(data.data)) {
        console.error("[oekobaudat] Unexpected list response shape");
        break;
      }

      // Insert basic materials from list (name + uuid) — no individual detail fetches
      // This gets us searchable materials quickly without 1000s of API calls.
      // Detailed indicators can be fetched on-demand later.
      for (const item of data.data) {
        allMaterials.push({
          id: "",
          sourceId: item.uuid,
          source: SOURCE_ID,
          name: item.name,
          nameOriginal: item.name,
          category: item.classification ?? "Uncategorized",
          density: null,
          unit: "kg",
          indicators: {},
          metadata: {
            version: "current",
            lastSynced: new Date(),
            scope: "A1-A3",
            standard: "EN 15804+A2",
          },
        });
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

      // Validate response is actually JSON
      const contentType = response.headers.get("content-type") ?? "";
      const text = await response.text();
      if (!contentType.includes("json") && !text.startsWith("{") && !text.startsWith("[")) {
        console.warn("[oekobaudat] Detail response not JSON for", uuid);
        return null;
      }
      return JSON.parse(text) as OekobaudatProcess;
    } catch {
      return null;
    }
  }

  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<NormalizedMaterial[]> {
    const conditions = [eq(lcaMaterials.source, SOURCE_ID)];

    if (query) {
      // Ökobaudat names are German — translate queries via keyword extraction.
      // Build OR clause: cleaned query + extracted German keywords.
      const cleaned = cleanIfcQuery(query);
      const keywords = extractOekobaudatSearchTerms(query);
      const allTerms = new Set([cleaned, query, ...keywords]);

      const likeClauses = [...allTerms]
        .filter(Boolean)
        .map((t) => {
          const escaped = t.replace(/[%_]/g, (ch) => `\\${ch}`);
          return like(lcaMaterials.name, `%${escaped}%`);
        });

      if (likeClauses.length === 1) {
        conditions.push(likeClauses[0]);
      } else if (likeClauses.length > 1) {
        conditions.push(or(...likeClauses)!);
      }
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

    const results = rows.map(rowToNormalized);

    // Lazily enrich results that are missing indicators (synced without detail)
    const toEnrich = results.filter(
      (r) => r.indicators.gwpTotal == null && r.sourceId
    );
    if (toEnrich.length > 0) {
      await Promise.allSettled(
        toEnrich.map(async (r) => {
          const detail = await this.fetchProcessDetail(r.sourceId);
          if (!detail) return;

          const indicators = extractIndicators(detail.lciaResults);
          const density = extractDensity(detail.flowProperties);

          // Update DB record
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          for (const [key, val] of Object.entries(indicators)) {
            if (val != null) updates[key] = val;
          }
          if (density != null) updates.density = density;

          if (Object.keys(updates).length > 1) {
            await db
              .update(lcaMaterials)
              .set(updates)
              .where(eq(lcaMaterials.id, r.id));

            // Update in-memory result
            Object.assign(r.indicators, indicators);
            if (density != null) r.density = density;
          }
        })
      );
    }

    return results;
  }

  async getById(sourceId: string): Promise<NormalizedMaterial | null> {
    const [row] = await db
      .select()
      .from(lcaMaterials)
      .where(
        and(
          eq(lcaMaterials.source, SOURCE_ID),
          eq(lcaMaterials.sourceId, sourceId)
        )
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
        const rows = batch.map((m) => {
          const ind = m.indicators;
          return {
            id: nanoid(),
            source: SOURCE_ID,
            sourceId: m.sourceId,
            name: m.name,
            nameOriginal: m.nameOriginal,
            category: m.category,
            density: m.density,
            unit: m.unit,
            gwpTotal: ind.gwpTotal ?? null,
            gwpFossil: ind.gwpFossil ?? null,
            gwpBiogenic: ind.gwpBiogenic ?? null,
            gwpLuluc: ind.gwpLuluc ?? null,
            penreTotal: ind.penreTotal ?? null,
            pereTotal: ind.pereTotal ?? null,
            ap: ind.ap ?? null,
            odp: ind.odp ?? null,
            pocp: ind.pocp ?? null,
            adpMineral: ind.adpMineral ?? null,
            adpFossil: ind.adpFossil ?? null,
            version: m.metadata.version,
            lastSynced: new Date(),
            scope: m.metadata.scope,
            standard: m.metadata.standard,
          };
        });

        await db
          .insert(lcaMaterials)
          .values(rows)
          .onConflictDoUpdate({
            target: [lcaMaterials.source, lcaMaterials.sourceId],
            set: {
              name: sql`excluded.name`,
              nameOriginal: sql`excluded.name_original`,
              category: sql`excluded.category`,
              density: sql`excluded.density`,
              unit: sql`excluded.unit`,
              gwpTotal: sql`excluded.gwp_total`,
              gwpFossil: sql`excluded.gwp_fossil`,
              gwpBiogenic: sql`excluded.gwp_biogenic`,
              gwpLuluc: sql`excluded.gwp_luluc`,
              penreTotal: sql`excluded.penre_total`,
              pereTotal: sql`excluded.pere_total`,
              ap: sql`excluded.ap`,
              odp: sql`excluded.odp`,
              pocp: sql`excluded.pocp`,
              adpMineral: sql`excluded.adp_mineral`,
              adpFossil: sql`excluded.adp_fossil`,
              version: sql`excluded.version`,
              lastSynced: sql`excluded.last_synced`,
              scope: sql`excluded.scope`,
              standard: sql`excluded.standard`,
              updatedAt: new Date(),
            },
          });

        result.added += batch.length;
      } catch (err) {
        result.errors.push(
          `Batch ${i}-${i + BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }
}
