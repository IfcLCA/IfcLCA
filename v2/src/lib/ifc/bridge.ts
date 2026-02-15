/**
 * Bridge: converts ifc-lite's IfcDataStore to our IFCParseResult.
 *
 * ifc-lite uses a columnar, lazy-extraction architecture.
 * We iterate entities, extract attributes/materials/classifications
 * on demand, and produce our app-level types.
 *
 * Volume extraction strategy (hybrid):
 *   1. Try IfcElementQuantity property sets (NetVolume / GrossVolume)
 *   2. Fall back to mesh geometry volume calculation
 *   3. Distribute element volume to layers via their fraction
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

// ---------------------------------------------------------------------------
// Volume extraction from IFC property sets
// ---------------------------------------------------------------------------

/** Property names that represent element volume (in priority order) */
const VOLUME_PROPERTY_NAMES = [
  "NetVolume",
  "GrossVolume",
  "Volume",
  "NetSideArea", // fallback — some slabs only have area
];

/**
 * Extract volume from IfcElementQuantity / Pset_*Common property sets.
 * Many IFC exporters include BaseQuantities with NetVolume or GrossVolume.
 */
function extractVolumeFromProperties(
  propSets: Array<{
    name: string;
    properties: Array<{ name: string; type: number; value: PropertyValue }>;
  }>
): number {
  for (const pset of propSets) {
    // Look in BaseQuantities and Qto_*BaseQuantities
    const isQuantitySet =
      pset.name === "BaseQuantities" ||
      pset.name.startsWith("Qto_") ||
      pset.name.includes("Quantities");

    if (!isQuantitySet) continue;

    for (const propName of VOLUME_PROPERTY_NAMES) {
      const prop = pset.properties.find((p) => p.name === propName);
      if (prop && typeof prop.value === "number" && prop.value > 0) {
        return prop.value;
      }
    }
  }

  // Second pass: look in any property set (some exporters put volume in custom psets)
  for (const pset of propSets) {
    for (const propName of VOLUME_PROPERTY_NAMES.slice(0, 3)) {
      const prop = pset.properties.find((p) => p.name === propName);
      if (prop && typeof prop.value === "number" && prop.value > 0) {
        return prop.value;
      }
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Mesh volume calculation from geometry (fallback)
// ---------------------------------------------------------------------------

/** Element mesh data cached during geometry processing */
export interface ElementMeshData {
  expressId: number;
  vertices: Float32Array;
  indices: Uint32Array;
}

/**
 * Calculate signed volume of a triangulated mesh using the divergence theorem.
 * For closed meshes, this gives exact volume; for open meshes, an approximation.
 */
function calculateMeshVolume(
  vertices: Float32Array,
  indices: Uint32Array
): number {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    // Signed volume of tetrahedron formed by origin and triangle
    vol +=
      (vertices[a] *
        (vertices[b + 1] * vertices[c + 2] -
          vertices[b + 2] * vertices[c + 1]) -
        vertices[a + 1] *
          (vertices[b] * vertices[c + 2] -
            vertices[b + 2] * vertices[c]) +
        vertices[a + 2] *
          (vertices[b] * vertices[c + 1] -
            vertices[b + 1] * vertices[c])) /
      6;
  }
  return Math.abs(vol);
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
 * Volume extraction: tries IfcElementQuantity property sets first,
 * falls back to mesh geometry volume calculation if meshData is provided.
 *
 * Async because it lazy-loads the extraction functions on first call.
 *
 * @param store        ifc-lite data store
 * @param fileSizeBytes IFC file size in bytes
 * @param parseTimeMs  Total parse time
 * @param meshData     Optional mesh data for geometry-based volume calculation
 */
export async function bridgeToParseResult(
  store: IfcDataStore,
  fileSizeBytes: number,
  parseTimeMs: number,
  meshData?: ElementMeshData[]
): Promise<IFCParseResult> {
  await ensureBridge();
  const elements: IFCElement[] = [];
  const materialAgg = new Map<
    string,
    { totalVolume: number; elementCount: number; elementTypes: Set<string> }
  >();

  const entities = store.entities;
  const hierarchy = store.spatialHierarchy;

  // Build mesh lookup: expressId → mesh data (for geometry volume fallback)
  const meshLookup = new Map<number, ElementMeshData>();
  if (meshData) {
    for (const mesh of meshData) {
      meshLookup.set(mesh.expressId, mesh);
    }
  }

  let volumeFromProps = 0;
  let volumeFromMesh = 0;
  let volumeMissing = 0;

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
            volume: 0, // Will be calculated after we know element volume
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

    // Extract properties for isLoadBearing / isExternal + volume
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

    // --- Volume extraction (hybrid strategy) ---
    // 1. Try IfcElementQuantity property sets (most reliable)
    let totalVolume = extractVolumeFromProperties(propSets);
    if (totalVolume > 0) {
      volumeFromProps++;
    } else {
      // 2. Fall back to mesh geometry calculation
      const mesh = meshLookup.get(expressId);
      if (mesh && mesh.vertices.length > 0 && mesh.indices.length > 0) {
        totalVolume = calculateMeshVolume(mesh.vertices, mesh.indices);
        if (totalVolume > 0) volumeFromMesh++;
        else volumeMissing++;
      } else {
        volumeMissing++;
      }
    }

    // Distribute volume to layers by their fraction
    for (const layer of layers) {
      layer.volume = totalVolume * layer.fraction;
    }

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

  console.log(
    `[bridge] Volume sources: ${volumeFromProps} from properties, ${volumeFromMesh} from mesh, ${volumeMissing} missing`
  );

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
    for (const [storeyId, storeyElements] of hierarchy.byStorey) {
      const attrs = extractEntityAttributes(store, storeyId);
      const elevation = hierarchy.storeyElevations.get(storeyId) ?? 0;

      // Resolve element expressIds to GUIDs
      const elementGuids: string[] = [];
      if (storeyElements) {
        for (const eId of storeyElements) {
          const elAttrs = extractEntityAttributes(store, eId);
          if (elAttrs.globalId) elementGuids.push(elAttrs.globalId);
        }
      }

      storeys.push({
        guid: attrs.globalId || `storey-${storeyId}`,
        name: attrs.name || `Storey ${storeyId}`,
        elevation,
        elementGuids,
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
