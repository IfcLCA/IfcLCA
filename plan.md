# Full 3D Integration Plan: Model-Centric Architecture

## Vision

The 3D model becomes the **single source of truth** for all interaction. Every UI element — charts, tables, panels — is a lens into the model. Clicking a chart bar isolates those elements in 3D. Selecting an element in 3D highlights it in the chart. Color modes paint the model with LCA results. The viewer is not a passive display — it's the application.

## Current State

**What works:**
- Element picking (`renderer.pick()`) → store → selection highlight
- Multi-select (Ctrl+Click) via `selectedIds` in RenderOptions
- Hide/show by element type via `hiddenIds` in RenderOptions
- Orbit, pan, zoom camera controls
- Hover detection (store tracks `hoveredElementId`, but no visual)

**What's available in ifc-lite but NOT wired:**
- `isolatedIds` in RenderOptions — show ONLY these elements (everything else hidden)
- `scene.setColorOverrides(Map<expressId, [r,g,b,a]>)` — per-element color override
- `camera.zoomToFit(min, max)` / `camera.frameBounds(min, max)` — animated camera framing
- `scene.getEntityBoundingBox(expressId)` — get bounds for a single element
- `camera.setPresetView('top'|'front'|'left'|...)` — preset camera angles
- `sectionPlane` in RenderOptions — clip the model by axis
- `renderer.captureScreenshot()` — for PDF/image export

**Key data mappings already maintained:**
- `viewerRefs.expressIdToGuid: Map<number, string>` (render → UI)
- `viewerRefs.guidToExpressId: Map<string, number>` (UI → render)
- `parseResult.elements[]` with guid, type, materials, totalVolume

---

## Phase A: Heatmap Color Engine

**Goal:** When user selects "GWP", "PENRE", "UBP", or "Match Status" in the toolbar, the 3D model paints every element with a color gradient based on its calculated indicator value.

### A.1: Build the color computation engine

**New file:** `v2/src/lib/viewer/color-engine.ts`

```typescript
export interface ColorMap {
  overrides: Map<number, [number, number, number, number]>; // expressId → RGBA [0-1]
  min: number;
  max: number;
  legend: Array<{ value: number; color: [number, number, number, number]; label: string }>;
}

// Heatmap: green (low) → yellow (mid) → red (high)
export function computeHeatmapColors(
  elements: IFCElement[],
  indicator: 'gwpTotal' | 'penreTotal' | 'ubp',
  materials: MaterialWithMatch[],
  guidToExpressId: Map<string, number>
): ColorMap

// Match status: green (matched) → red (unmatched) → gray (no material)
export function computeMatchStatusColors(
  elements: IFCElement[],
  materials: MaterialWithMatch[],
  guidToExpressId: Map<string, number>
): ColorMap

// Element type: distinct color per IfcWall, IfcSlab, etc.
export function computeTypeColors(
  elements: IFCElement[],
  guidToExpressId: Map<string, number>
): ColorMap
```

**Color gradient for heatmap:**
- 0% (low): `[0.18, 0.80, 0.44, 1.0]` (green)
- 50% (mid): `[1.0, 0.84, 0.0, 1.0]` (yellow)
- 100% (high): `[0.91, 0.30, 0.24, 1.0]` (red)
- No data: `[0.6, 0.6, 0.6, 0.4]` (translucent gray)

### A.2: Apply color overrides to renderer

**Modified:** `v2/src/components/viewer/ifc-viewer.tsx`

In the render loop and on colorMode/material changes:

```typescript
// When colorMode or materials change → recompute colors
useEffect(() => {
  const r = rendererRef.current as any;
  if (!r || !parseResult) return;

  const scene = r.getScene();
  const state = useAppStore.getState();

  if (state.colorMode === 'matchStatus') {
    const colorMap = computeMatchStatusColors(parseResult.elements, state.materials, viewerRefs.guidToExpressId);
    scene.setColorOverrides(colorMap.overrides, r.getGPUDevice(), r.getPipeline());
  } else if (['gwpTotal', 'penreTotal', 'ubp'].includes(state.colorMode)) {
    const colorMap = computeHeatmapColors(parseResult.elements, state.colorMode, state.materials, viewerRefs.guidToExpressId);
    scene.setColorOverrides(colorMap.overrides, r.getGPUDevice(), r.getPipeline());
  } else if (state.colorMode === 'elementType') {
    const colorMap = computeTypeColors(parseResult.elements, viewerRefs.guidToExpressId);
    scene.setColorOverrides(colorMap.overrides, r.getGPUDevice(), r.getPipeline());
  }

  r.render();
}, [colorMode, materials, parseResult]);
```

### A.3: Color legend overlay

**New file:** `v2/src/components/viewer/color-legend.tsx`

Positioned over the 3D canvas (bottom-left). Shows:
- Gradient bar (for heatmap modes): min → max with labels
- Discrete legend (for match status / element type): colored dots + labels
- Current mode name

Toggleable — appears when a color mode is active, can be dismissed.

### A.4: Toolbar enhancements

**Modified:** `v2/src/components/viewer/toolbar.tsx`

- Add "UBP" button (missing from current toolbar)
- Add "Data Source" color mode
- Visual indicator that coloring is active (border glow or badge)
- Add "Reset Colors" button to return to default

---

## Phase B: Chart ↔ 3D Bidirectional Interaction

**Goal:** Click a bar in the chart → those elements isolate in 3D + camera frames them. Hover a chart bar → elements highlight in 3D. This is the core "model-centric" feature.

### B.1: Build element group lookup

**New utility:** `v2/src/lib/viewer/element-groups.ts`

Pre-builds maps for fast lookup:
```typescript
// material name → Set<guid>
export function groupByMaterial(elements: IFCElement[]): Map<string, Set<string>>

// element type → Set<guid>
export function groupByType(elements: IFCElement[]): Map<string, Set<string>>

// category → Set<guid>
export function groupByCategory(elements: IFCElement[]): Map<string, Set<string>>
```

### B.2: Add isolation state to store

**Modified:** `v2/src/lib/store/app-store.ts`

```typescript
interface AppState {
  // ... existing state ...

  // 3D interaction state
  isolatedElementIds: Set<string> | null;  // null = show all, Set = only show these
  highlightedElementIds: Set<string>;      // temporary visual highlight (hover from chart)

  // Actions
  isolateElements: (guids: Set<string> | null) => void;
  highlightElements: (guids: Set<string>) => void;
  clearHighlight: () => void;
  frameSelection: () => void;  // zoom camera to current selection/isolation
}
```

### B.3: Wire isolation + highlight into render loop

**Modified:** `v2/src/components/viewer/ifc-viewer.tsx`

```typescript
// In render loop:
const isolatedIds = state.isolatedElementIds
  ? new Set([...state.isolatedElementIds].map(g => viewerRefs.guidToExpressId.get(g)).filter(Boolean))
  : null;

const highlightIds = new Set<number>();
for (const guid of state.highlightedElementIds) {
  const eid = viewerRefs.guidToExpressId.get(guid);
  if (eid !== undefined) highlightIds.add(eid);
}

r.render({
  selectedIds: selectedIds.size > 0 ? selectedIds : undefined,
  hiddenIds: hiddenIds.size > 0 ? hiddenIds : undefined,
  isolatedIds,
  // highlightIds rendered as secondary selection with different color
});
```

### B.4: Make charts interactive → 3D

**Modified:** `v2/src/components/charts/emissions-chart.tsx`

Add click and hover handlers to chart bars/slices:

```typescript
<Bar
  dataKey="value"
  onClick={(data) => {
    // Isolate elements belonging to this material/type/category
    const guids = elementGroups.get(data.fullName);
    if (guids) {
      isolateElements(guids);
      frameSelection();
    }
  }}
  onMouseEnter={(data) => {
    const guids = elementGroups.get(data.fullName);
    if (guids) highlightElements(guids);
  }}
  onMouseLeave={() => clearHighlight()}
/>
```

### B.5: Add "Show All" / "Clear Isolation" button

When elements are isolated, show a floating button over the 3D canvas:
```
[x] Showing 12 of 156 elements — Show All
```

Clicking it calls `isolateElements(null)` to reset.

### B.6: Camera framing on isolation

When elements are isolated or selected, animate the camera to frame just those elements:

```typescript
function frameElements(guids: Set<string>) {
  const scene = (rendererRef.current as any).getScene();
  let minBounds = { x: Infinity, y: Infinity, z: Infinity };
  let maxBounds = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const guid of guids) {
    const eid = viewerRefs.guidToExpressId.get(guid);
    if (eid === undefined) continue;
    const bbox = scene.getEntityBoundingBox(eid);
    if (!bbox) continue;
    // Expand combined bounds
    minBounds = { x: Math.min(minBounds.x, bbox.min.x), ... };
    maxBounds = { x: Math.max(maxBounds.x, bbox.max.x), ... };
  }

  camera.zoomToFit(minBounds, maxBounds, 500); // 500ms animation
}
```

---

## Phase C: 3D → Charts/Table Bidirectional

**Goal:** Select elements in 3D → charts and table highlight the corresponding materials/types. The UI follows the model, not the other way around.

### C.1: Selection-aware chart highlighting

**Modified:** `v2/src/components/charts/emissions-chart.tsx`

When elements are selected in 3D:
- Bar chart highlights the bars containing selected elements
- Pie chart highlights the slices containing selected elements

```typescript
const selectedMaterials = useMemo(() => {
  const names = new Set<string>();
  for (const guid of selectedElementIds) {
    const el = parseResult?.elements.find(e => e.guid === guid);
    if (el) for (const mat of el.materials) names.add(mat.name);
  }
  return names;
}, [selectedElementIds, parseResult]);

// In chart rendering:
<Cell
  fill={selectedMaterials.has(entry.fullName) ? HIGHLIGHT_COLOR : CHART_COLORS[idx]}
  stroke={selectedMaterials.has(entry.fullName) ? '#000' : undefined}
  strokeWidth={selectedMaterials.has(entry.fullName) ? 2 : 0}
/>
```

### C.2: Selection-aware table highlighting

**Modified:** `v2/src/components/panels/bottom-panel.tsx`

When elements are selected in 3D:
- Scroll the table to show materials used by selected elements
- Highlight those rows with a subtle background color
- Show a count badge: "Used in 3 selected elements"

### C.3: Element detail panel → 3D framing

**Modified:** `v2/src/components/panels/element-detail.tsx`

When element detail panel opens:
- "Frame in 3D" button zooms camera to that element
- Material layers show individual volumes + calculated indicators
- Click a material layer → highlight that layer's elements in 3D

### C.4: Material match panel → 3D isolation

**Modified:** `v2/src/components/panels/material-match.tsx` (or `context-panel.tsx`)

When matching a material:
- Show a preview: "This material is used in 23 elements"
- "Show in 3D" button isolates all elements using that material
- After matching, color updates immediately in 3D

---

## Phase D: Storey-Based Navigation

**Goal:** Navigate the model by building storeys. Toggle storey visibility, isolate a floor, see per-storey emissions.

### D.1: Build storey → element mapping

**Modified:** `v2/src/lib/ifc/bridge.ts`

During bridging, also extract which elements belong to which storey using ifc-lite's spatial hierarchy:

```typescript
// bridge.ts addition:
const storeyElements = new Map<string, Set<string>>(); // storeyGuid → elementGuids

// Use dataStore.spatialHierarchy to walk the tree:
// IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → elements
```

Add to `IFCParseResult`:
```typescript
interface IFCStorey {
  guid: string;
  name: string;
  elevation: number;
  elementGuids: string[];
}
```

### D.2: Storey panel in toolbar/sidebar

**New file:** `v2/src/components/viewer/storey-panel.tsx`

Collapsible list of storeys with:
- Toggle visibility per storey (checkbox)
- Click storey → isolate its elements + frame camera
- Show per-storey emission totals (mini bar chart)
- Current elevation indicator

### D.3: Wire storey visibility to renderer

The store already has `visibilityByStorey: Record<string, boolean>`, and the render loop already builds `hiddenIds` from type visibility. Extend this to include storey visibility:

```typescript
// In render loop:
for (const [storey, visible] of Object.entries(state.visibilityByStorey)) {
  if (!visible) {
    const guids = storeyElements.get(storey) ?? [];
    for (const guid of guids) {
      const eid = viewerRefs.guidToExpressId.get(guid);
      if (eid !== undefined) hiddenIds.add(eid);
    }
  }
}
```

---

## Phase E: Enhanced Viewer Controls

**Goal:** Professional BIM-viewer quality controls: preset views, section planes, screenshot.

### E.1: Preset view buttons

**Modified:** `v2/src/components/viewer/toolbar.tsx`

Add preset view dropdown:
- Top / Bottom / Front / Back / Left / Right
- Uses `camera.setPresetView('top', bounds)` with animation

### E.2: Section plane control

**New file:** `v2/src/components/viewer/section-control.tsx`

Slider that clips the model along an axis:
```typescript
renderer.render({
  sectionPlane: {
    axis: 'down',
    position: sliderValue, // 0-100
    enabled: true,
  }
});
```

Three axis buttons (X/Y/Z) + slider. Shows cross-section for storey navigation.

### E.3: Screenshot capture

**New file:** `v2/src/components/viewer/screenshot-button.tsx`

Calls `renderer.captureScreenshot()` → downloads PNG.
Also used for print/PDF integration — embed a 3D screenshot in the print report.

### E.4: Fit-to-selection button

When elements are selected, show a "Frame" button in the toolbar that calls `frameElements()`.

---

## Phase F: Real-Time Indicator Feedback

**Goal:** As the user matches materials, the 3D model updates in real-time. No page refresh needed. The model is always showing the current state.

### F.1: Reactive color updates

When `updateMaterialMatch()` is called in the store:
1. Recalculate per-element indicators (client-side, from `calculations.ts`)
2. Recompute color overrides for the active `colorMode`
3. Apply to renderer immediately

This should be a Zustand `subscribe()` — whenever `materials` changes AND `colorMode` is indicator-based, recompute colors.

### F.2: Match progress visualization

During auto-match (SSE streaming):
- Each material match triggers an immediate color update
- User watches the model "paint itself" as matches come in
- Dramatic, satisfying visual feedback

### F.3: Unmatched element flash

When hovering over an unmatched material in the table:
- Flash those elements in 3D with a pulsing outline
- Strong visual cue: "these are the elements that need your attention"

---

## Implementation Order

```
Phase A (Color Engine)        ←── Foundation for all visual features
  ↓
Phase B (Chart → 3D)         ←── Core bidirectional interaction
Phase C (3D → Chart/Table)   ←── Can run parallel with B
  ↓
Phase D (Storey Navigation)  ←── Builds on isolation/visibility from B
Phase E (Viewer Controls)    ←── Independent, can start anytime
  ↓
Phase F (Real-time Feedback) ←── Builds on A+B, final polish
```

**Critical path:** A → B → F

**Parallelizable:** C runs with B. D and E are independent.

---

## Files to Create

| File | Purpose |
|------|---------|
| `v2/src/lib/viewer/color-engine.ts` | Heatmap/match/type color computation |
| `v2/src/lib/viewer/element-groups.ts` | Material→elements, type→elements lookup maps |
| `v2/src/components/viewer/color-legend.tsx` | Gradient/discrete legend overlay on canvas |
| `v2/src/components/viewer/storey-panel.tsx` | Storey list with visibility toggles |
| `v2/src/components/viewer/section-control.tsx` | Section plane slider |
| `v2/src/components/viewer/screenshot-button.tsx` | Screenshot capture button |

## Files to Modify

| File | Changes |
|------|---------|
| `v2/src/components/viewer/ifc-viewer.tsx` | Color overrides, isolation, highlight, camera framing, section planes |
| `v2/src/components/viewer/toolbar.tsx` | Preset views, UBP mode, section toggle, screenshot |
| `v2/src/components/charts/emissions-chart.tsx` | Click→isolate, hover→highlight, selection-aware highlighting |
| `v2/src/components/panels/bottom-panel.tsx` | Selection-aware row highlighting, "show in 3D" |
| `v2/src/components/panels/element-detail.tsx` | "Frame in 3D" button, per-layer indicators |
| `v2/src/components/panels/project-summary.tsx` | Chart click → 3D isolation |
| `v2/src/lib/store/app-store.ts` | isolatedElementIds, highlightedElementIds, frameSelection |
| `v2/src/lib/ifc/bridge.ts` | Storey→element mapping |
| `v2/src/types/ifc.ts` | Add elementGuids to IFCStorey type |
| `v2/src/components/print/print-report.tsx` | Embed 3D screenshot |

---

## Key ifc-lite API Usage

| Feature | API | Status |
|---------|-----|--------|
| Per-element coloring | `scene.setColorOverrides(Map<expressId, [r,g,b,a]>)` | Internal, needs `getScene()` + `getGPUDevice()` + `getPipeline()` |
| Element isolation | `renderer.render({ isolatedIds: Set<number> })` | Public, ready to use |
| Element hiding | `renderer.render({ hiddenIds: Set<number> })` | Public, already in use |
| Selection highlight | `renderer.render({ selectedIds: Set<number> })` | Public, already in use |
| Camera framing | `camera.zoomToFit(min, max, duration?)` | Public, not used |
| Element bounds | `scene.getEntityBoundingBox(expressId)` | Public, not used |
| Preset views | `camera.setPresetView('top'|...)` | Public, not used |
| Section planes | `renderer.render({ sectionPlane: {...} })` | Public, not used |
| Screenshot | `renderer.captureScreenshot()` | Public, not used |
| GPU pick | `renderer.pick(x, y, options?)` | Public, already in use |

All colors are **RGBA [0-1] float arrays**, NOT hex or 0-255.
