/**
 * Refreshes the cached KBOB table from lcadata.ch.
 *
 * Runs from the daily Vercel cron (/api/kbob/sync) or `npm run kbob:sync`.
 * Request handlers only read the cache (repositories/kbob.ts), so a slow or
 * failing lcadata.ch never blocks a page load.
 */
import type { PrismaClient } from "@prisma/client";
import type { KbobApiMaterial, KbobApiResponse } from "@/types/kbob-api";
import { parseDensity } from "@/lib/utils/kbob-indicators";

const DEFAULT_BASE_URL = "https://www.lcadata.ch";

export interface KbobRow {
  id: string;
  nameDE: string;
  nameFR: string | null;
  group: string | null;
  unit: string | null;
  density: number | null;
  gwpTotal: number | null;
  ubp21Total: number | null;
  penreTotal: number | null;
  version: string;
  syncedAt: Date;
}

export async function fetchKbobFromApi(options: {
  apiKey: string | undefined;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<KbobApiResponse> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new Error("KBOB_API_KEY is not set");
  }
  const url = `${options.baseUrl || DEFAULT_BASE_URL}/api/kbob/materials?pageSize=all`;
  const response = await (options.fetchImpl ?? fetch)(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `lcadata.ch responded ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }
  const data = (await response.json()) as KbobApiResponse;
  if (!Array.isArray(data?.materials) || typeof data.version !== "string") {
    throw new Error("lcadata.ch response has no materials array or version");
  }
  return data;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toKbobRow(material: KbobApiMaterial, version: string, syncedAt: Date): KbobRow {
  return {
    id: material.uuid,
    nameDE: material.nameDE,
    nameFR: material.nameFR || null,
    group: material.group || null,
    unit: material.unit || null,
    density: parseDensity(material.density),
    gwpTotal: numberOrNull(material.gwpTotal),
    ubp21Total: numberOrNull(material.ubp21Total),
    penreTotal: numberOrNull(material.primaryEnergyNonRenewableTotal),
    version,
    syncedAt,
  };
}

/**
 * Upserts every material from the API response. Rows that disappeared from
 * the API are kept, because project materials may still point at them.
 * All-or-nothing: one transaction, so a failed sync leaves the old cache.
 */
export async function saveKbobResponse(
  db: PrismaClient,
  response: KbobApiResponse,
  now = new Date()
): Promise<{ synced: number; skipped: number; version: string }> {
  const rows = response.materials
    .filter((m) => typeof m?.uuid === "string" && m.uuid && typeof m.nameDE === "string")
    .map((m) => toKbobRow(m, response.version, now));

  await db.$transaction(
    rows.map((row) => {
      const { id, ...data } = row;
      return db.kbobMaterial.upsert({ where: { id }, create: row, update: data });
    })
  );

  return {
    synced: rows.length,
    skipped: response.materials.length - rows.length,
    version: response.version,
  };
}

export async function syncKbob(db: PrismaClient) {
  const response = await fetchKbobFromApi({
    apiKey: process.env.KBOB_API_KEY,
    baseUrl: process.env.KBOB_API_URL,
  });
  return saveKbobResponse(db, response);
}
