/**
 * Bridge: converts ifc-lite's IfcDataStore to our IFCParseResult.
 *
 * ifc-lite uses a columnar, lazy-extraction architecture.
 * We iterate entities, extract attributes/materials/classifications
 * on demand, and produce our app-level types.
 */

import type { IfcDataStore } from "@ifc-lite/parser";
import type {
  IFCElement,
  IFCMaterialLayer,
  IFCMaterialSummary,
  IFCParseResult,
} from "@/types/ifc";

// ifc-lite extraction functions (imported dynamically to keep bundle split)
let extractEntityAttributes: (store: IfcDataStore, id: number) => {
  globalId: string;
  name: string;
  description: string;
  objectType: string;
  tag: string;
};
let extractMaterials: (store: IfcDataStore, id: number) => {
  type: string;
  name?: string;
  layers?: Array<{ name?: string; thickness?: number; fraction?: number }>;
  profiles?: Array<{ name?: string }>;
  constituents?: Array<{ name?: string; fraction?: number }>;
  materials?: string[];
} | null;
let extractClassifications: (store: IfcDataStore, id: number) => Array<{
  system?: string;
  identification?: string;
  name?: string;
}>;
import type { PropertyValue } from "@ifc-lite/data";
let extractProperties: (store: IfcDataStore, id: number) => Array<{
  name: string;
  globalId?: string;
  properties: Array<{ name: string; type: number; value: PropertyValue }>;
}>;

let bridgeInitialized = false;

async function ensureBridge(): Promise<void> {
  if (bridgeInitialized) return;

  const parser = await import("@ifc-lite/parser");
  extractEntityAttributes = parser.extractEntityAttributesOnDemand;
  extractMaterials = parser.extractMaterialsOnDemand;
  extractClassifications = parser.extractClassificationsOnDemand;
  extractProperties = parser.extractPropertiesOnDemand;
  bridgeInitialized = true;
}

// Element types we care about for LCA
const LCA_ELEMENT_TYPES = new Set([
  "IfcWall",
  "IfcWallStandardCase",
  "IfcSlab",
  "IfcRoof",
  "IfcColumn",
  "IfcBeam",
  "IfcDoor",
  "IfcWindow",
  "IfcCovering",
  "IfcCurtainWall",
  "IfcPlate",
  "IfcMember",
  "IfcStairFlight",
  "IfcStair",
  "IfcRamp",
  "IfcRampFlight",
  "IfcRailing",
  "IfcFooting",
  "IfcPile",
  "IfcBuildingElementProxy",
]);

/**
 * Convert an IfcDataStore to our IFCParseResult format.
 *
 * This does the heavy extraction work — iterates all building elements,
 * pulls attributes, materials, classifications, and aggregates.
 *
 * Async because it lazy-loads the extraction functions on first call.
 */
export async function bridgeToParseResult(
  store: IfcDataStore,
  fileSizeBytes: number,
  parseTimeMs: number
): Promise<IFCParseResult> {
  await ensureBridge();
  const elements: IFCElement[] = [];
  const materialAgg = new Map<
    string,
    { totalVolume: number; elementCount: number; elementTypes: Set<string> }
  >();

  const entities = store.entities;
  const hierarchy = store.spatialHierarchy;

  // Iterate all entities
  for (let i = 0; i < entities.expressId.length; i++) {
    const expressId = entities.expressId[i];
    const typeName = entities.getTypeName(expressId);

    if (!LCA_ELEMENT_TYPES.has(typeName)) continue;

    // Extract attributes (lazy from source buffer)
    const attrs = extractEntityAttributes(store, expressId);
    if (!attrs.globalId) continue;

    // Extract materials
    const matInfo = extractMaterials(store, expressId);
    const layers: IFCMaterialLayer[] = [];

    if (matInfo) {
      if (matInfo.layers && matInfo.layers.length > 0) {
        // Material layer set (most common for walls, slabs)
        const totalThickness = matInfo.layers.reduce(
          (sum, l) => sum + (l.thickness ?? 0),
          0
        );

        for (const layer of matInfo.layers) {
          const name = layer.name ?? "Unknown Material";
          const fraction =
            totalThickness > 0
              ? (layer.thickness ?? 0) / totalThickness
              : 1 / matInfo.layers.length;

          layers.push({
            name,
            volume: 0, // Will be calculated per-element when we have geometry volumes
            fraction,
            thickness: layer.thickness,
          });
        }
      } else if (matInfo.constituents && matInfo.constituents.length > 0) {
        for (const c of matInfo.constituents) {
          layers.push({
            name: c.name ?? "Unknown Material",
            volume: 0,
            fraction: c.fraction ?? 1 / matInfo.constituents.length,
          });
        }
      } else if (matInfo.materials && matInfo.materials.length > 0) {
        for (const name of matInfo.materials) {
          layers.push({
            name,
            volume: 0,
            fraction: 1 / matInfo.materials.length,
          });
        }
      } else if (matInfo.name) {
        layers.push({
          name: matInfo.name,
          volume: 0,
          fraction: 1,
        });
      }
    }

    if (layers.length === 0) {
      layers.push({
        name: "Unspecified Material",
        volume: 0,
        fraction: 1,
      });
    }

    // Extract classifications
    const classInfo = extractClassifications(store, expressId);
    const classification = classInfo.length > 0
      ? {
          system: classInfo[0].system ?? "Unknown",
          code: classInfo[0].identification ?? "",
          name: classInfo[0].name ?? "",
        }
      : undefined;

    // Extract properties for isLoadBearing / isExternal
    let isLoadBearing = false;
    let isExternal = false;

    const propSets = extractProperties(store, expressId);
    for (const pset of propSets) {
      if (pset.name === "Pset_WallCommon" || pset.name === "Pset_SlabCommon" || pset.name === "Pset_ColumnCommon") {
        const lb = pset.properties.find((p) => p.name === "LoadBearing");
        if (lb && lb.value === true) isLoadBearing = true;

        const ext = pset.properties.find((p) => p.name === "IsExternal");
        if (ext && ext.value === true) isExternal = true;
      }
    }

    // Total volume — approximate from layers or use a default
    // (real volume comes from geometry, which we can calculate later)
    const totalVolume = 0; // Placeholder — updated when geometry volumes are computed

    const element: IFCElement = {
      guid: attrs.globalId,
      name: attrs.name || `${typeName} #${expressId}`,
      type: typeName,
      loadBearing: isLoadBearing,
      isExternal,
      classification,
      materials: layers,
      totalVolume,
    };

    elements.push(element);

    // Aggregate materials
    for (const layer of layers) {
      const existing = materialAgg.get(layer.name);
      if (existing) {
        existing.totalVolume += layer.volume;
        existing.elementCount++;
        existing.elementTypes.add(typeName);
      } else {
        materialAgg.set(layer.name, {
          totalVolume: layer.volume,
          elementCount: 1,
          elementTypes: new Set([typeName]),
        });
      }
    }
  }

  // Build material summaries
  const materials: IFCMaterialSummary[] = Array.from(materialAgg.entries()).map(
    ([name, agg]) => ({
      name,
      totalVolume: agg.totalVolume,
      elementCount: agg.elementCount,
      elementTypes: Array.from(agg.elementTypes),
    })
  );

  // Extract storeys from spatial hierarchy
  const storeys: IFCParseResult["storeys"] = [];
  if (hierarchy) {
    for (const [storeyId, _elements] of hierarchy.byStorey) {
      const attrs = extractEntityAttributes(store, storeyId);
      const elevation = hierarchy.storeyElevations.get(storeyId) ?? 0;
      storeys.push({
        guid: attrs.globalId || `storey-${storeyId}`,
        name: attrs.name || `Storey ${storeyId}`,
        elevation,
      });
    }
    storeys.sort((a, b) => a.elevation - b.elevation);
  }

  return {
    elements,
    materials,
    projectInfo: {
      name: hierarchy?.project?.name,
      schema: store.schemaVersion,
    },
    storeys,
    stats: {
      parseTimeMs,
      elementCount: elements.length,
      materialCount: materials.length,
      fileSizeBytes,
    },
  };
}

/**
 * Lazy per-element detail extraction.
 *
 * Instead of extracting all property sets for every element upfront,
 * this function extracts full details for a single element on demand
 * (e.g., when the user clicks an element in the viewer).
 */
export async function getElementDetail(
  store: IfcDataStore,
  expressId: number
): Promise<{
  attrs: { globalId: string; name: string; description: string; objectType: string; tag: string };
  materials: ReturnType<typeof extractMaterials>;
  classifications: ReturnType<typeof extractClassifications>;
  propertySets: ReturnType<typeof extractProperties>;
} | null> {
  await ensureBridge();

  const typeName = store.entities.getTypeName(expressId);
  if (!LCA_ELEMENT_TYPES.has(typeName)) return null;

  const attrs = extractEntityAttributes(store, expressId);
  if (!attrs.globalId) return null;

  return {
    attrs,
    materials: extractMaterials(store, expressId),
    classifications: extractClassifications(store, expressId),
    propertySets: extractProperties(store, expressId),
  };
}

/**
 * Initialize the bridge (preload extraction functions).
 * Call this early to avoid delay during first file load.
 */
export async function initBridge(): Promise<void> {
  await ensureBridge();
}
