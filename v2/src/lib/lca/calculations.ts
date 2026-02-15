/**
 * LCA calculation engine.
 *
 * Pure functions for computing environmental indicators.
 * No side effects, no DB access — just math.
 */

import type {
  IndicatorKey,
  IndicatorValues,
  NormalizedMaterial,
  ProjectEmissions,
} from "@/types/lca";
import type { ProjectElement } from "@/types/project";
import { INDICATOR_REGISTRY } from "@/types/lca";

// ---------------------------------------------------------------------------
// Per-material-layer calculation
// ---------------------------------------------------------------------------

/**
 * Calculate indicator values for a single material layer.
 *
 * Formula: volume × density × indicator_factor
 *
 * @param volume      Volume of the material layer in m³
 * @param density     Material density in kg/m³
 * @param lcaMaterial The matched LCA material with indicator factors
 * @returns Calculated indicator values, or null if inputs are insufficient
 */
export function calculateLayerIndicators(
  volume: number,
  density: number | null | undefined,
  lcaMaterial: NormalizedMaterial | null
): IndicatorValues | null {
  if (!lcaMaterial || !density || density <= 0 || volume <= 0) {
    return null;
  }

  const mass = volume * density;
  const result: IndicatorValues = {};

  for (const key of Object.keys(lcaMaterial.indicators) as IndicatorKey[]) {
    const factor = lcaMaterial.indicators[key];
    if (factor !== null && factor !== undefined) {
      result[key] = mass * factor;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Sum two sets of indicator values */
export function sumIndicators(
  a: IndicatorValues,
  b: IndicatorValues
): IndicatorValues {
  const result: IndicatorValues = { ...a };

  for (const key of Object.keys(b) as IndicatorKey[]) {
    const bVal = b[key];
    if (bVal !== null && bVal !== undefined) {
      result[key] = (result[key] ?? 0) + bVal;
    }
  }

  return result;
}

/** Sum an array of indicator values */
export function sumAllIndicators(values: IndicatorValues[]): IndicatorValues {
  return values.reduce((acc, v) => sumIndicators(acc, v), {});
}

/** Calculate project-level emissions from all elements */
export function calculateProjectEmissions(
  elements: ProjectElement[]
): ProjectEmissions {
  const totals: IndicatorValues = {};
  const byCategory: Record<string, IndicatorValues> = {};
  const byElementType: Record<string, IndicatorValues> = {};

  for (const element of elements) {
    const elementIndicators: IndicatorValues[] = [];

    for (const matLayer of element.materials) {
      if (matLayer.indicators) {
        elementIndicators.push(matLayer.indicators);
      }
    }

    if (elementIndicators.length === 0) continue;

    const elementTotal = sumAllIndicators(elementIndicators);

    // Add to project totals
    Object.assign(totals, sumIndicators(totals, elementTotal));

    // Group by classification category
    const catKey = element.classification?.code ?? "unclassified";
    byCategory[catKey] = sumIndicators(
      byCategory[catKey] ?? {},
      elementTotal
    );

    // Group by element type
    byElementType[element.type] = sumIndicators(
      byElementType[element.type] ?? {},
      elementTotal
    );
  }

  return {
    totals,
    byCategory,
    byElementType,
    lastCalculated: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Relative emissions (per m²·a)
// ---------------------------------------------------------------------------

/**
 * Calculate relative emissions per m² per year.
 *
 * @param absolute     Absolute indicator value
 * @param area         Reference area in m²
 * @param amortization Amortization period in years
 */
export function relativeEmission(
  absolute: number,
  area: number,
  amortization: number
): number {
  if (area <= 0 || amortization <= 0) return 0;
  return absolute / (area * amortization);
}

// ---------------------------------------------------------------------------
// Heatmap utilities
// ---------------------------------------------------------------------------

/**
 * Get all available indicators from an array of elements.
 * Returns only indicators that have at least one non-null value.
 */
export function getAvailableIndicators(
  elements: ProjectElement[]
): IndicatorKey[] {
  const found = new Set<IndicatorKey>();

  for (const el of elements) {
    for (const mat of el.materials) {
      if (!mat.indicators) continue;
      for (const key of Object.keys(mat.indicators) as IndicatorKey[]) {
        if (mat.indicators[key] !== null && mat.indicators[key] !== undefined) {
          found.add(key);
        }
      }
    }
  }

  // Sort by the INDICATOR_REGISTRY order (core first)
  const allKeys = Object.keys(INDICATOR_REGISTRY) as IndicatorKey[];
  return allKeys.filter((k) => found.has(k));
}

/**
 * Compute per-element indicator values for heatmap coloring.
 *
 * Returns a map of elementGuid → indicator value,
 * plus the min/max for color scale normalization.
 */
export function computeHeatmapData(
  elements: ProjectElement[],
  indicator: IndicatorKey
): {
  values: Map<string, number>;
  min: number;
  max: number;
} {
  const values = new Map<string, number>();
  let min = Infinity;
  let max = -Infinity;

  for (const el of elements) {
    let total = 0;
    for (const mat of el.materials) {
      total += mat.indicators?.[indicator] ?? 0;
    }
    values.set(el.guid, total);
    if (total < min) min = total;
    if (total > max) max = total;
  }

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  return { values, min, max };
}
