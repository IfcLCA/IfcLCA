/**
 * Server-side LCA calculation engine.
 *
 * Reads element-material junctions from the DB, calculates indicators
 * (volume × density × factor), and persists results back.
 *
 * Called after:
 *  - Upload (volumes now available)
 *  - Material match/unmatch
 *  - Auto-match completion
 */

import { db } from "@/db";
import {
  elementMaterials,
  elements,
  materials,
  lcaMaterials,
  projects,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface CalculationResult {
  totals: {
    gwpTotal: number;
    penreTotal: number;
    ubpTotal: number;
  };
  elementCount: number;
  layerCount: number;
  calculatedAt: Date;
}

/**
 * Recalculate all LCA indicators for a project.
 *
 * 1. Fetch all elementMaterials joined with materials + lcaMaterials
 * 2. For each layer: indicators = volume × density × factor
 * 3. Batch-update elementMaterials with calculated values
 * 4. Aggregate per element → update elements cache
 * 5. Aggregate per project → update projects cache
 */
export async function recalculateProject(
  projectId: string
): Promise<CalculationResult> {
  const calculatedAt = new Date();

  // Step 1: Fetch all element-material junctions with LCA data
  const rows = await db
    .select({
      emId: elementMaterials.id,
      elementId: elementMaterials.elementId,
      volume: elementMaterials.volume,
      fraction: elementMaterials.fraction,
      materialId: elementMaterials.materialId,
      density: lcaMaterials.density,
      gwpFactor: lcaMaterials.gwpTotal,
      penreFactor: lcaMaterials.penreTotal,
      ubpFactor: lcaMaterials.ubp,
    })
    .from(elementMaterials)
    .innerJoin(elements, eq(elementMaterials.elementId, elements.id))
    .innerJoin(materials, eq(elementMaterials.materialId, materials.id))
    .leftJoin(lcaMaterials, eq(materials.lcaMaterialId, lcaMaterials.id))
    .where(eq(elements.projectId, projectId));

  // Step 2: Calculate per-layer indicators
  const layerUpdates: Array<{
    id: string;
    gwpTotal: number | null;
    penreTotal: number | null;
    ubp: number | null;
  }> = [];

  const elementTotals = new Map<
    string,
    { gwp: number; penre: number; ubp: number }
  >();

  for (const row of rows) {
    const volume = row.volume ?? 0;
    const density = row.density;
    const hasMatch = density != null && density > 0 && volume > 0;

    const gwp = hasMatch && row.gwpFactor != null
      ? volume * density! * row.gwpFactor
      : null;
    const penre = hasMatch && row.penreFactor != null
      ? volume * density! * row.penreFactor
      : null;
    const ubp = hasMatch && row.ubpFactor != null
      ? volume * density! * row.ubpFactor
      : null;

    layerUpdates.push({
      id: row.emId,
      gwpTotal: gwp,
      penreTotal: penre,
      ubp: ubp,
    });

    // Accumulate per-element
    const existing = elementTotals.get(row.elementId) ?? {
      gwp: 0,
      penre: 0,
      ubp: 0,
    };
    if (gwp != null) existing.gwp += gwp;
    if (penre != null) existing.penre += penre;
    if (ubp != null) existing.ubp += ubp;
    elementTotals.set(row.elementId, existing);
  }

  // Step 3: Batch-update elementMaterials
  const BATCH = 500;
  for (let i = 0; i < layerUpdates.length; i += BATCH) {
    const batch = layerUpdates.slice(i, i + BATCH);
    // Use individual updates — SQLite doesn't support CASE expressions well in Turso
    await db.transaction(async (tx) => {
      for (const u of batch) {
        await tx
          .update(elementMaterials)
          .set({
            gwpTotal: u.gwpTotal,
            penreTotal: u.penreTotal,
            ubp: u.ubp,
          })
          .where(eq(elementMaterials.id, u.id));
      }
    });
  }

  // Step 4: Update per-element cached totals
  const elementIds = Array.from(elementTotals.keys());
  for (let i = 0; i < elementIds.length; i += BATCH) {
    const batch = elementIds.slice(i, i + BATCH);
    await db.transaction(async (tx) => {
      for (const elId of batch) {
        const totals = elementTotals.get(elId)!;
        await tx
          .update(elements)
          .set({
            gwpTotal: totals.gwp || null,
            penreTotal: totals.penre || null,
            ubp: totals.ubp || null,
          })
          .where(eq(elements.id, elId));
      }
    });
  }

  // Step 5: Aggregate project totals
  let projectGwp = 0;
  let projectPenre = 0;
  let projectUbp = 0;
  for (const [, totals] of elementTotals) {
    projectGwp += totals.gwp;
    projectPenre += totals.penre;
    projectUbp += totals.ubp;
  }

  await db
    .update(projects)
    .set({
      gwpTotal: projectGwp || null,
      penreTotal: projectPenre || null,
      ubpTotal: projectUbp || null,
      emissionsCalculatedAt: calculatedAt,
      updatedAt: calculatedAt,
    })
    .where(eq(projects.id, projectId));

  console.log(
    `[calculate] Project ${projectId}: GWP=${projectGwp.toFixed(2)}, PENRE=${projectPenre.toFixed(2)}, UBP=${projectUbp.toFixed(0)} (${rows.length} layers, ${elementTotals.size} elements)`
  );

  return {
    totals: {
      gwpTotal: projectGwp,
      penreTotal: projectPenre,
      ubpTotal: projectUbp,
    },
    elementCount: elementTotals.size,
    layerCount: rows.length,
    calculatedAt,
  };
}
