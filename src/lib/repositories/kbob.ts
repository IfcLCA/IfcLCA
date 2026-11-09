import type { KbobMaterial } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError, UnavailableError } from "@/lib/errors";
import type { IKBOBMaterial } from "@/types/material";

/** JSON shape the UI has always received (field names from the Mongo era). */
export function toKbobDto(row: KbobMaterial): IKBOBMaterial & { id: string } {
  return {
    _id: row.id,
    id: row.id,
    uuid: row.id,
    Name: row.nameDE,
    nameDE: row.nameDE,
    nameFR: row.nameFR ?? undefined,
    Category: row.group ?? undefined,
    group: row.group ?? undefined,
    unit: row.unit ?? undefined,
    density: row.density,
    gwpTotal: row.gwpTotal,
    ubp21Total: row.ubp21Total,
    primaryEnergyNonRenewableTotal: row.penreTotal,
    version: row.version,
    lastUpdated: row.syncedAt,
  };
}

/** Same rule as isValidKbobMaterial, expressed as a query. */
const usableWhere = {
  gwpTotal: { not: null },
  ubp21Total: { not: null },
  penreTotal: { not: null },
  density: { gt: 0 },
  NOT: { gwpTotal: 0, ubp21Total: 0, penreTotal: 0 },
};

/**
 * Materials offered for matching. Throws UnavailableError when the cache is
 * empty, so the UI shows "not synced yet" instead of an empty list.
 */
export async function listUsableKbobMaterials() {
  const rows = await db.kbobMaterial.findMany({ where: usableWhere, orderBy: { nameDE: "asc" } });
  if (rows.length === 0) {
    throw new UnavailableError(
      "The KBOB material list has not been synced yet. Run the KBOB sync and try again."
    );
  }
  return rows.map(toKbobDto);
}

export async function getKbobMaterial(id: string): Promise<KbobMaterial> {
  const row = await db.kbobMaterial.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("KBOB material");
  return row;
}

export async function kbobCacheStatus() {
  const agg = await db.kbobMaterial.aggregate({ _count: true, _max: { syncedAt: true } });
  return { count: agg._count, lastSyncedAt: agg._max.syncedAt };
}
