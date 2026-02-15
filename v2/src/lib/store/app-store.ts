/**
 * Main application store — manages viewer state, selections,
 * project data, and LCA matching state.
 *
 * Also holds refs to ifc-lite native objects (Renderer, IfcDataStore)
 * outside of Zustand's immutable state for performance.
 */

import { create } from "zustand";
import type {
  ColorMode,
  IndicatorKey,
  IndicatorValues,
  MaterialMatch,
  NormalizedMaterial,
} from "@/types/lca";
import type { IFCMaterialSummary, IFCParseResult } from "@/types/ifc";
import type { LoadProgress } from "@/lib/ifc/loader";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface ProjectData {
  id: string;
  name: string;
  preferredDataSource: string;
  areaType?: string | null;
  areaValue?: number | null;
  amortization?: number | null;
  description?: string | null;
}

export interface MaterialWithMatch extends IFCMaterialSummary {
  dbId?: string;
  match?: MaterialMatch;
  matchedMaterial?: NormalizedMaterial;
  density?: number;
  indicators?: IndicatorValues;
}

export interface AutoMatchProgress {
  phase: "idle" | "matching" | "done";
  matched: number;
  total: number;
  message: string;
}

export type ContextPanelMode = "summary" | "element" | "material";

export interface AppState {
  // IFC model data (client-side, from ifc-lite parsing)
  parseResult: IFCParseResult | null;
  modelLoading: boolean;
  modelError: string | null;
  loadProgress: LoadProgress | null;

  // Project data (from server)
  project: ProjectData | null;

  // Materials with match state
  materials: MaterialWithMatch[];
  matchedCount: number;
  totalMaterialCount: number;

  // Viewer state
  selectedElementIds: Set<string>;
  hoveredElementId: string | null;
  colorMode: ColorMode;
  heatmapIndicator: IndicatorKey;
  visibilityByType: Record<string, boolean>;
  visibilityByStorey: Record<string, boolean>;

  // 3D interaction state
  isolatedElementIds: Set<string> | null; // null = show all, Set = only show these
  highlightedElementIds: Set<string>; // temporary highlight (hover from chart)

  // UI state
  contextPanelMode: ContextPanelMode;
  selectedMaterialName: string | null;
  batchMatchMaterials: string[]; // multi-select batch matching
  bottomPanelOpen: boolean;

  // Active data source
  activeDataSource: string;

  // Auto-match progress
  autoMatchProgress: AutoMatchProgress;

  // Actions
  setParseResult: (result: IFCParseResult) => void;
  setModelLoading: (loading: boolean) => void;
  setModelError: (error: string | null) => void;
  setLoadProgress: (progress: LoadProgress | null) => void;
  setProject: (project: ProjectData) => void;

  setMaterials: (materials: MaterialWithMatch[]) => void;
  updateMaterialMatch: (
    materialName: string,
    match: MaterialMatch | null,
    matchedMaterial: NormalizedMaterial | null
  ) => void;

  selectElement: (guid: string) => void;
  deselectAll: () => void;
  toggleElementSelection: (guid: string) => void;
  setHoveredElement: (guid: string | null) => void;

  setColorMode: (mode: ColorMode) => void;
  setHeatmapIndicator: (indicator: IndicatorKey) => void;
  toggleTypeVisibility: (type: string) => void;
  toggleStoreyVisibility: (storey: string) => void;

  isolateElements: (guids: Set<string> | null) => void;
  highlightElements: (guids: Set<string>) => void;
  clearHighlight: () => void;

  setContextPanelMode: (mode: ContextPanelMode) => void;
  setSelectedMaterial: (name: string | null) => void;
  setBatchMatchMaterials: (names: string[]) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setActiveDataSource: (source: string) => void;
  setAutoMatchProgress: (progress: AutoMatchProgress) => void;
  clearAllMatches: () => void;

  reset: () => void;
}

// ---------------------------------------------------------------------------
// Mutable refs — ifc-lite objects live outside Zustand for performance.
// These are NOT reactive state; components that need them access directly.
// ---------------------------------------------------------------------------

export interface SectionPlaneState {
  axis: "down" | "front" | "side";
  position: number;
  enabled: boolean;
}

interface ViewerRefs {
  renderer: unknown | null; // Renderer — typed as unknown to avoid SSR import
  dataStore: unknown | null; // IfcDataStore
  coordinateInfo: unknown | null; // CoordinateInfo
  canvas: HTMLCanvasElement | null;
  /** expressId → globalId mapping for pick results */
  expressIdToGuid: Map<number, string>;
  /** globalId → expressId mapping for selection → renderer */
  guidToExpressId: Map<string, number>;
  /** Promise that resolves when the renderer is initialized */
  rendererReady: Promise<void>;
  /** Call to signal renderer is ready (set internally by viewer) */
  rendererReadyResolve: (() => void) | null;
  /** Current section plane state (mutable for real-time slider) */
  sectionPlane: SectionPlaneState | null;
}

function createRendererReadyPromise() {
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve: resolve! };
}

const { promise: rendererReadyPromise, resolve: rendererReadyResolve } =
  createRendererReadyPromise();

export const viewerRefs: ViewerRefs = {
  renderer: null,
  dataStore: null,
  coordinateInfo: null,
  canvas: null,
  expressIdToGuid: new Map(),
  guidToExpressId: new Map(),
  sectionPlane: null,
  rendererReady: rendererReadyPromise,
  rendererReadyResolve,
};

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  parseResult: null,
  modelLoading: false,
  modelError: null,
  loadProgress: null,
  project: null,
  materials: [],
  matchedCount: 0,
  totalMaterialCount: 0,
  selectedElementIds: new Set<string>(),
  hoveredElementId: null,
  isolatedElementIds: null as Set<string> | null,
  highlightedElementIds: new Set<string>(),
  colorMode: "matchStatus" as ColorMode,
  heatmapIndicator: "gwpTotal" as IndicatorKey,
  visibilityByType: {} as Record<string, boolean>,
  visibilityByStorey: {} as Record<string, boolean>,
  contextPanelMode: "summary" as ContextPanelMode,
  selectedMaterialName: null as string | null,
  batchMatchMaterials: [] as string[],
  bottomPanelOpen: false,
  activeDataSource: "kbob",
  autoMatchProgress: { phase: "idle", matched: 0, total: 0, message: "" } as AutoMatchProgress,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setParseResult: (result) => {
    // Preserve existing match data (from server hydration) when IFC loads from cache
    const existing = get().materials;
    const existingByName = new Map<string, MaterialWithMatch>();
    for (const m of existing) existingByName.set(m.name, m);

    const materials: MaterialWithMatch[] = result.materials.map((m) => {
      const prev = existingByName.get(m.name);
      if (prev?.match) {
        // Keep match data, update parse-derived fields
        return {
          ...prev,
          totalVolume: m.totalVolume,
          elementCount: m.elementCount,
          elementTypes: m.elementTypes,
        };
      }
      return { ...m };
    });

    // Initialize visibility toggles
    const types = new Set(result.elements.map((e) => e.type));
    const visibilityByType: Record<string, boolean> = {};
    for (const t of types) visibilityByType[t] = true;

    const visibilityByStorey: Record<string, boolean> = {};
    for (const s of result.storeys) visibilityByStorey[s.name] = true;

    set({
      parseResult: result,
      materials,
      totalMaterialCount: materials.length,
      matchedCount: materials.filter((m) => m.match).length,
      visibilityByType,
      visibilityByStorey,
      modelLoading: false,
      modelError: null,
      loadProgress: null,
      bottomPanelOpen: materials.length > 0,
    });
  },

  setModelLoading: (loading) => set({ modelLoading: loading }),
  setModelError: (error) => set({ modelError: error, modelLoading: false }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),
  setProject: (project) =>
    set({ project, activeDataSource: project.preferredDataSource }),

  setMaterials: (materials) =>
    set({
      materials,
      totalMaterialCount: materials.length,
      matchedCount: materials.filter((m) => m.match).length,
    }),

  updateMaterialMatch: (materialName, match, matchedMaterial) =>
    set((state) => {
      const materials = state.materials.map((m) =>
        m.name === materialName
          ? {
              ...m,
              match: match ?? undefined,
              matchedMaterial: matchedMaterial ?? undefined,
              density: matchedMaterial?.density ?? m.density,
              indicators: matchedMaterial?.indicators ?? m.indicators,
            }
          : m
      );
      return {
        materials,
        matchedCount: materials.filter((m) => m.match).length,
      };
    }),

  selectElement: (guid) =>
    set({
      selectedElementIds: new Set([guid]),
      contextPanelMode: "element",
    }),

  deselectAll: () =>
    set({
      selectedElementIds: new Set(),
      contextPanelMode: "summary",
      selectedMaterialName: null,
    }),

  toggleElementSelection: (guid) =>
    set((state) => {
      const next = new Set(state.selectedElementIds);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return {
        selectedElementIds: next,
        contextPanelMode: next.size > 0 ? "element" : "summary",
      };
    }),

  setHoveredElement: (guid) => set({ hoveredElementId: guid }),

  setColorMode: (mode) => set({ colorMode: mode }),
  setHeatmapIndicator: (indicator) => set({ heatmapIndicator: indicator }),

  toggleTypeVisibility: (type) =>
    set((state) => ({
      visibilityByType: {
        ...state.visibilityByType,
        [type]: !state.visibilityByType[type],
      },
    })),

  toggleStoreyVisibility: (storey) =>
    set((state) => ({
      visibilityByStorey: {
        ...state.visibilityByStorey,
        [storey]: !state.visibilityByStorey[storey],
      },
    })),

  isolateElements: (guids) => set({ isolatedElementIds: guids }),
  highlightElements: (guids) => set({ highlightedElementIds: guids }),
  clearHighlight: () => set({ highlightedElementIds: new Set() }),

  setContextPanelMode: (mode) => set({ contextPanelMode: mode }),

  setSelectedMaterial: (name) =>
    set({
      selectedMaterialName: name,
      batchMatchMaterials: [],
      contextPanelMode: name ? "material" : "summary",
    }),

  setBatchMatchMaterials: (names) =>
    set({
      batchMatchMaterials: names,
      selectedMaterialName: names.length > 0 ? names[0] : null,
      contextPanelMode: names.length > 0 ? "material" : "summary",
    }),

  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  setActiveDataSource: (source) => set({ activeDataSource: source }),
  setAutoMatchProgress: (progress) => set({ autoMatchProgress: progress }),
  clearAllMatches: () =>
    set((state) => ({
      materials: state.materials.map((m) => ({
        ...m,
        match: undefined,
        matchedMaterial: undefined,
        indicators: undefined,
      })),
      matchedCount: 0,
    })),

  reset: () => {
    viewerRefs.renderer = null;
    viewerRefs.dataStore = null;
    viewerRefs.coordinateInfo = null;
    viewerRefs.canvas = null;
    viewerRefs.expressIdToGuid.clear();
    viewerRefs.guidToExpressId.clear();
    // Recreate renderer ready promise for next load cycle
    const { promise, resolve } = createRendererReadyPromise();
    viewerRefs.rendererReady = promise;
    viewerRefs.rendererReadyResolve = resolve;
    set(initialState);
  },
}));
