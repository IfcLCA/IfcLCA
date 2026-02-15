/**
 * IFC loading orchestrator — coordinates ifc-lite parsing and geometry processing.
 *
 * Flow:
 * 1. Stream geometry (processAdaptive) → user sees 3D model immediately
 * 2. Parse data model (parseLite) → extract elements, materials, properties
 * 3. Bridge to app types (IFCParseResult) → populate store
 *
 * All heavy work happens client-side via WASM.
 */

import type { GeometryProcessor, CoordinateInfo } from "@ifc-lite/geometry";
import type { IfcDataStore, EntityRef } from "@ifc-lite/parser";
import type { Renderer } from "@ifc-lite/renderer";
import { bridgeToParseResult } from "./bridge";
import type { ElementMeshData } from "./bridge";
import type { IFCParseResult } from "@/types/ifc";

// ---------------------------------------------------------------------------
// Loading progress
// ---------------------------------------------------------------------------

export interface LoadProgress {
  phase: "geometry" | "parsing" | "extracting" | "complete";
  percent: number;
  meshCount?: number;
  message: string;
}

export type ProgressCallback = (progress: LoadProgress) => void;

// ---------------------------------------------------------------------------
// Loader result
// ---------------------------------------------------------------------------

export interface LoadResult {
  /** Bridged parse result (app-level types) */
  parseResult: IFCParseResult;
  /** Raw ifc-lite data store (for on-demand queries) */
  dataStore: IfcDataStore;
  /** Coordinate info from geometry processing */
  coordinateInfo: CoordinateInfo | null;
}

// ---------------------------------------------------------------------------
// Singleton geometry processor (expensive to init, reuse across loads)
// ---------------------------------------------------------------------------

let geometryProcessor: GeometryProcessor | null = null;

async function getGeometryProcessor(): Promise<GeometryProcessor> {
  if (geometryProcessor) return geometryProcessor;

  const { GeometryProcessor: GP } = await import("@ifc-lite/geometry");
  geometryProcessor = new GP();
  await geometryProcessor.init();
  return geometryProcessor;
}

// ---------------------------------------------------------------------------
// Main loading function
// ---------------------------------------------------------------------------

/**
 * Load an IFC file: stream geometry to the renderer, then parse the data model.
 *
 * @param buffer  - Raw file contents
 * @param renderer - The ifc-lite Renderer instance (already initialized)
 * @param onProgress - Progress callback
 * @returns LoadResult with parse data and raw data store
 */
export async function loadIfcFile(
  buffer: Uint8Array,
  renderer: Renderer,
  onProgress?: ProgressCallback
): Promise<LoadResult> {
  const startTime = performance.now();

  // Get a clean ArrayBuffer that exactly matches the Uint8Array bounds.
  // buffer.buffer may be larger if the Uint8Array is a view into a shared buffer.
  const arrayBuffer: ArrayBuffer =
    buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
      ? (buffer.buffer as ArrayBuffer)
      : (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

  // Phase 1: Stream geometry → 3D model visible fast
  onProgress?.({
    phase: "geometry",
    percent: 0,
    message: "Initializing geometry processor...",
  });

  const gp = await getGeometryProcessor();
  let meshCount = 0;
  let coordinateInfo: CoordinateInfo | null = null;

  // Collect mesh geometry data for volume calculation
  const meshDataMap = new Map<number, ElementMeshData>();

  onProgress?.({
    phase: "geometry",
    percent: 5,
    message: "Processing geometry...",
  });

  for await (const event of gp.processAdaptive(buffer)) {
    switch (event.type) {
      case "batch":
        renderer.addMeshes(event.meshes, true);
        meshCount += event.meshes.length;
        if (event.coordinateInfo) coordinateInfo = event.coordinateInfo;

        // Capture mesh geometry for volume calculation
        // MeshData from @ifc-lite/geometry uses `positions` (Float32Array) and `indices` (Uint32Array)
        for (const mesh of event.meshes) {
          if (mesh.expressId != null && mesh.positions && mesh.indices) {
            const existing = meshDataMap.get(mesh.expressId);
            if (existing) {
              // Merge mesh data: concatenate positions and offset indices
              const vertexOffset = existing.vertices.length / 3;
              const newVertices = new Float32Array(
                existing.vertices.length + mesh.positions.length
              );
              newVertices.set(existing.vertices);
              newVertices.set(mesh.positions, existing.vertices.length);

              const newIndices = new Uint32Array(
                existing.indices.length + mesh.indices.length
              );
              newIndices.set(existing.indices);
              for (let j = 0; j < mesh.indices.length; j++) {
                newIndices[existing.indices.length + j] =
                  mesh.indices[j] + vertexOffset;
              }
              meshDataMap.set(mesh.expressId, {
                expressId: mesh.expressId,
                vertices: newVertices,
                indices: newIndices,
              });
            } else {
              meshDataMap.set(mesh.expressId, {
                expressId: mesh.expressId,
                vertices: new Float32Array(mesh.positions),
                indices: new Uint32Array(mesh.indices),
              });
            }
          }
        }

        onProgress?.({
          phase: "geometry",
          percent: Math.min(80, 5 + (meshCount / Math.max(event.totalSoFar, 1)) * 75),
          meshCount,
          message: `Loaded ${meshCount} meshes...`,
        });
        break;
      case "complete":
        meshCount = event.totalMeshes;
        coordinateInfo = event.coordinateInfo;
        onProgress?.({
          phase: "geometry",
          percent: 80,
          meshCount,
          message: `Geometry complete: ${meshCount} meshes`,
        });
        break;
    }
  }

  // Phase 2: Parse data model (runs after geometry is visible)
  onProgress?.({
    phase: "parsing",
    percent: 85,
    message: "Parsing IFC data model...",
  });

  const { ColumnarParser: CP, IfcParser } = await import("@ifc-lite/parser");
  const parser = new CP();

  // Quick index scan to get entity refs for the columnar parser
  const indexParser = new IfcParser();
  const quickResult = await indexParser.parse(arrayBuffer);
  const entityRefs: EntityRef[] = Array.from(
    quickResult.entityIndex.byId.values()
  );

  const dataStore = await parser.parseLite(arrayBuffer, entityRefs, {
    onProgress: (p: { phase: string; percent: number }) => {
      onProgress?.({
        phase: "parsing",
        percent: 85 + (p.percent / 100) * 10,
        message: `Parsing: ${p.phase}...`,
      });
    },
  });

  // Phase 3: Bridge to app types
  onProgress?.({
    phase: "extracting",
    percent: 95,
    message: "Extracting elements and materials...",
  });

  const parseTimeMs = performance.now() - startTime;
  const meshDataArray = Array.from(meshDataMap.values());
  const parseResult = await bridgeToParseResult(
    dataStore,
    buffer.byteLength,
    parseTimeMs,
    meshDataArray
  );

  onProgress?.({
    phase: "complete",
    percent: 100,
    meshCount,
    message: `Loaded ${parseResult.stats.elementCount} elements, ${parseResult.stats.materialCount} materials`,
  });

  return { parseResult, dataStore, coordinateInfo };
}

/**
 * Cleanup geometry processor resources.
 * Call when the app unmounts or user navigates away.
 */
export function disposeLoader(): void {
  if (geometryProcessor) {
    geometryProcessor.dispose();
    geometryProcessor = null;
  }
}
