/**
 * Color Engine — computes per-element color overrides for the 3D viewer.
 *
 * Supports multiple coloring modes:
 * - Heatmap (GWP, PENRE, UBP): green → yellow → red gradient based on indicator value
 * - Match status: green (matched) → red (unmatched) → gray (no material)
 * - Element type: distinct color per IFC type
 */

import type { IFCElement } from "@/types/ifc";
import type { MaterialWithMatch } from "@/lib/store/app-store";
import type { IndicatorKey } from "@/types/lca";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorMap {
  /** expressId → RGBA [0-1] float array */
  overrides: Map<number, [number, number, number, number]>;
  /** Min value in the dataset (for legend) */
  min: number;
  /** Max value in the dataset (for legend) */
  max: number;
  /** Legend entries for display */
  legend: LegendEntry[];
}

export interface LegendEntry {
  value: number;
  color: [number, number, number, number];
  label: string;
}

// ---------------------------------------------------------------------------
// Heatmap gradient stops: green → yellow → red
// ---------------------------------------------------------------------------

const HEATMAP_LOW: [number, number, number, number] = [0.18, 0.8, 0.44, 1.0]; // green
const HEATMAP_MID: [number, number, number, number] = [1.0, 0.84, 0.0, 1.0]; // yellow
const HEATMAP_HIGH: [number, number, number, number] = [0.91, 0.3, 0.24, 1.0]; // red
const NO_DATA_COLOR: [number, number, number, number] = [0.6, 0.6, 0.6, 0.35]; // translucent gray

// Match status colors
const MATCHED_COLOR: [number, number, number, number] = [0.18, 0.8, 0.44, 1.0]; // green
const UNMATCHED_COLOR: [number, number, number, number] = [0.91, 0.3, 0.24, 1.0]; // red
const NO_MATERIAL_COLOR: [number, number, number, number] = [0.6, 0.6, 0.6, 0.35]; // gray

// Distinct colors for element types
const TYPE_COLORS: [number, number, number, number][] = [
  [0.30, 0.69, 0.31, 1.0], // green
  [0.25, 0.47, 0.85, 1.0], // blue
  [1.00, 0.60, 0.00, 1.0], // orange
  [0.61, 0.35, 0.71, 1.0], // purple
  [0.90, 0.30, 0.30, 1.0], // red
  [0.00, 0.74, 0.83, 1.0], // teal
  [0.96, 0.76, 0.07, 1.0], // yellow
  [0.85, 0.44, 0.84, 1.0], // pink
  [0.47, 0.33, 0.28, 1.0], // brown
  [0.55, 0.76, 0.29, 1.0], // lime
];

// ---------------------------------------------------------------------------
// Gradient interpolation
// ---------------------------------------------------------------------------

function lerpColor(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function heatmapColor(t: number): [number, number, number, number] {
  // t: 0 (low) → 1 (high)
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    return lerpColor(HEATMAP_LOW, HEATMAP_MID, clamped * 2);
  }
  return lerpColor(HEATMAP_MID, HEATMAP_HIGH, (clamped - 0.5) * 2);
}

// ---------------------------------------------------------------------------
// Build material lookup: material name → indicators + density
// ---------------------------------------------------------------------------

function buildMaterialLookup(materials: MaterialWithMatch[]) {
  const map = new Map<
    string,
    { density: number; indicators: Record<string, number | null | undefined>; matched: boolean }
  >();
  for (const mat of materials) {
    map.set(mat.name, {
      density: mat.density ?? 0,
      indicators: mat.matchedMaterial?.indicators ?? {},
      matched: !!mat.match,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Compute per-element indicator value
// ---------------------------------------------------------------------------

function computeElementIndicator(
  element: IFCElement,
  indicator: IndicatorKey,
  matLookup: ReturnType<typeof buildMaterialLookup>,
): number | null {
  let total = 0;
  let hasData = false;

  for (const layer of element.materials) {
    const matInfo = matLookup.get(layer.name);
    if (!matInfo || !matInfo.matched) continue;

    const density = matInfo.density;
    const factor = matInfo.indicators[indicator];
    if (density == null || density <= 0 || factor == null) continue;

    const mass = layer.volume * density;
    total += mass * factor;
    hasData = true;
  }

  return hasData ? total : null;
}

// ---------------------------------------------------------------------------
// Heatmap color mode
// ---------------------------------------------------------------------------

export function computeHeatmapColors(
  elements: IFCElement[],
  indicator: IndicatorKey,
  materials: MaterialWithMatch[],
  guidToExpressId: Map<string, number>,
): ColorMap {
  const matLookup = buildMaterialLookup(materials);

  // First pass: compute values and find min/max
  const values = new Map<number, number>();
  let min = Infinity;
  let max = -Infinity;

  for (const el of elements) {
    const eid = guidToExpressId.get(el.guid);
    if (eid === undefined) continue;

    const val = computeElementIndicator(el, indicator, matLookup);
    if (val !== null) {
      values.set(eid, val);
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  if (min === Infinity) {
    min = 0;
    max = 0;
  }

  // Second pass: assign colors
  const overrides = new Map<number, [number, number, number, number]>();
  const range = max - min;

  for (const el of elements) {
    const eid = guidToExpressId.get(el.guid);
    if (eid === undefined) continue;

    const val = values.get(eid);
    if (val === undefined) {
      overrides.set(eid, NO_DATA_COLOR);
    } else {
      const t = range > 0 ? (val - min) / range : 0.5;
      overrides.set(eid, heatmapColor(t));
    }
  }

  // Build legend
  const legend: LegendEntry[] = [
    { value: min, color: HEATMAP_LOW, label: formatValue(min) },
    { value: (min + max) / 2, color: HEATMAP_MID, label: formatValue((min + max) / 2) },
    { value: max, color: HEATMAP_HIGH, label: formatValue(max) },
  ];

  return { overrides, min, max, legend };
}

// ---------------------------------------------------------------------------
// Match status color mode
// ---------------------------------------------------------------------------

export function computeMatchStatusColors(
  elements: IFCElement[],
  materials: MaterialWithMatch[],
  guidToExpressId: Map<string, number>,
): ColorMap {
  const matLookup = buildMaterialLookup(materials);

  const overrides = new Map<number, [number, number, number, number]>();

  for (const el of elements) {
    const eid = guidToExpressId.get(el.guid);
    if (eid === undefined) continue;

    if (el.materials.length === 0) {
      overrides.set(eid, NO_MATERIAL_COLOR);
      continue;
    }

    // Check if all, some, or no materials are matched
    let matchedLayers = 0;
    let totalLayers = 0;
    for (const layer of el.materials) {
      totalLayers++;
      const matInfo = matLookup.get(layer.name);
      if (matInfo?.matched) matchedLayers++;
    }

    if (matchedLayers === totalLayers) {
      overrides.set(eid, MATCHED_COLOR);
    } else if (matchedLayers > 0) {
      // Partially matched — blend green/red
      const ratio = matchedLayers / totalLayers;
      overrides.set(eid, lerpColor(UNMATCHED_COLOR, MATCHED_COLOR, ratio));
    } else {
      overrides.set(eid, UNMATCHED_COLOR);
    }
  }

  const legend: LegendEntry[] = [
    { value: 1, color: MATCHED_COLOR, label: "Matched" },
    { value: 0.5, color: lerpColor(UNMATCHED_COLOR, MATCHED_COLOR, 0.5), label: "Partial" },
    { value: 0, color: UNMATCHED_COLOR, label: "Unmatched" },
  ];

  return { overrides, min: 0, max: 1, legend };
}

// ---------------------------------------------------------------------------
// Element type color mode
// ---------------------------------------------------------------------------

export function computeTypeColors(
  elements: IFCElement[],
  guidToExpressId: Map<string, number>,
): ColorMap {
  // Collect unique types
  const types = [...new Set(elements.map((e) => e.type))].sort();
  const typeColorMap = new Map<string, [number, number, number, number]>();
  types.forEach((t, i) => {
    typeColorMap.set(t, TYPE_COLORS[i % TYPE_COLORS.length]);
  });

  const overrides = new Map<number, [number, number, number, number]>();

  for (const el of elements) {
    const eid = guidToExpressId.get(el.guid);
    if (eid === undefined) continue;
    overrides.set(eid, typeColorMap.get(el.type) ?? NO_DATA_COLOR);
  }

  const legend: LegendEntry[] = types.map((t, i) => ({
    value: i,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
    label: t.replace("Ifc", ""),
  }));

  return { overrides, min: 0, max: types.length - 1, legend };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  return v.toFixed(1);
}
