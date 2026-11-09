import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ZERO_INDICATORS, type Indicators } from "@/lib/utils/kbob-indicators";

/**
 * Project totals, computed from the layers on every read.
 *
 * Nothing is stored, so there is no recalculation step to forget after a
 * match, an upload, or a deletion. Same formula as layerEmissions().
 */
export async function emissionsByProject(projectIds: string[]): Promise<Map<string, Indicators>> {
  const result = new Map<string, Indicators>();
  if (projectIds.length === 0) return result;

  const rows = await db.$queryRaw<Array<{ project_id: string; gwp: number; ubp: number; penre: number }>>`
    SELECT e.project_id,
           COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.gwp_total, 0)), 0)::float8   AS gwp,
           COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.ubp21_total, 0)), 0)::float8 AS ubp,
           COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.penre_total, 0)), 0)::float8 AS penre
    FROM element_materials em
    JOIN elements e ON e.id = em.element_id
    JOIN materials m ON m.id = em.material_id
    LEFT JOIN kbob_materials k ON k.id = m.kbob_id
    WHERE e.project_id IN (${Prisma.join(projectIds)})
    GROUP BY e.project_id`;

  for (const id of projectIds) result.set(id, { ...ZERO_INDICATORS });
  for (const row of rows) {
    result.set(row.project_id, { gwp: row.gwp, ubp: row.ubp, penre: row.penre });
  }
  return result;
}

export async function emissionsForUser(userId: string): Promise<Indicators> {
  const [row] = await db.$queryRaw<Indicators[]>`
    SELECT COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.gwp_total, 0)), 0)::float8   AS gwp,
           COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.ubp21_total, 0)), 0)::float8 AS ubp,
           COALESCE(SUM(em.volume * COALESCE(m.density, 0) * COALESCE(k.penre_total, 0)), 0)::float8 AS penre
    FROM element_materials em
    JOIN materials m ON m.id = em.material_id
    JOIN projects p ON p.id = m.project_id
    LEFT JOIN kbob_materials k ON k.id = m.kbob_id
    WHERE p.user_id = ${userId}`;
  return row ?? { ...ZERO_INDICATORS };
}
