/**
 * Element group lookups — maps from material name / element type to sets of element GUIDs.
 *
 * Used for chart ↔ 3D bidirectional interaction:
 * click a bar chart → get the element GUIDs → isolate/highlight in 3D.
 */

import type { IFCElement } from "@/types/ifc";

/**
 * Groups elements by material name.
 * A single element may appear in multiple material groups if it has multiple layers.
 */
export function groupByMaterial(elements: IFCElement[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const el of elements) {
    for (const layer of el.materials) {
      let set = map.get(layer.name);
      if (!set) {
        set = new Set();
        map.set(layer.name, set);
      }
      set.add(el.guid);
    }
  }
  return map;
}

/**
 * Groups elements by IFC entity type (e.g., "IfcWall", "IfcSlab").
 */
export function groupByType(elements: IFCElement[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const el of elements) {
    let set = map.get(el.type);
    if (!set) {
      set = new Set();
      map.set(el.type, set);
    }
    set.add(el.guid);
  }
  return map;
}

/**
 * Groups elements by classification system code (e.g., eBKP-H codes).
 */
export function groupByClassification(elements: IFCElement[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const el of elements) {
    const code = el.classification?.code ?? "Unclassified";
    let set = map.get(code);
    if (!set) {
      set = new Set();
      map.set(code, set);
    }
    set.add(el.guid);
  }
  return map;
}
