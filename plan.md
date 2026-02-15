# V1 → V2 Feature Parity: Detailed Implementation Plan

## Current State Summary

V2 has: 3D viewer, multi-source matching (KBOB + Ökobaudat), SSE streaming auto-match, materials table with CSV export, composite scoring with EOL filtering + Durchschnitt preference.

V2 is missing: **actual LCA calculations** (all volumes = 0), charts, IFC export, relative emissions UI, project edit, upload history, activity feed, print/PDF.

---

## Phase 1: Volume Extraction from IFC (Foundation)

**Why first:** Every subsequent feature depends on having real volumes. Currently `totalVolume = 0` for all materials and `elementMaterials.volume = 0` for all layers.

### Step 1.1: Extract volumes from ifc-lite geometry

**File:** `v2/src/lib/ifc/bridge.ts`

ifc-lite's `GeometryProcessor` computes mesh geometry. After geometry processing, volumes can be derived from the mesh data. However, ifc-lite may not expose per-element volumes directly.

**Approach A (Preferred):** Check if ifc-lite exposes `IfcQuantityVolume` from `IfcElementQuantity` property sets. Many IFC files include BaseQuantities with `NetVolume` or `GrossVolume`. Extract these in bridge.ts via `extractPropertiesOnDemand()` which already runs for each element.

```typescript
// In bridge.ts, inside element extraction loop:
const props = extractPropertiesOnDemand(dataStore, expressId);
const volume = props?.NetVolume ?? props?.GrossVolume ?? props?.Volume ?? 0;
```

**Approach B (Fallback):** If BaseQuantities are missing, compute volume from mesh geometry. ifc-lite's `GeometryProcessor` produces `Float32Array` vertex buffers per element. Volume can be calculated from the signed volume of the mesh triangles:

```typescript
function meshVolume(vertices: Float32Array, indices: Uint32Array): number {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i+1] * 3, c = indices[i+2] * 3;
    // Signed volume of tetrahedron (origin, v0, v1, v2)
    vol += (vertices[a] * (vertices[b+1]*vertices[c+2] - vertices[b+2]*vertices[c+1])
          - vertices[a+1] * (vertices[b]*vertices[c+2] - vertices[b+2]*vertices[c])
          + vertices[a+2] * (vertices[b]*vertices[c+1] - vertices[b+1]*vertices[c])) / 6;
  }
  return Math.abs(vol);
}
```

**Approach C (Hybrid):** Try IfcQuantityVolume first, fall back to mesh calculation. This is the most robust.

### Step 1.2: Distribute volume to material layers

**File:** `v2/src/lib/ifc/bridge.ts`

Once element `totalVolume` is known, distribute to layers using their `fraction`:

```typescript
// Already have fractions computed from thickness ratios
for (const layer of element.materials) {
  layer.volume = element.totalVolume * layer.fraction;
}
```

For `IFCMaterialSummary`, aggregate:
```typescript
materialSummary.totalVolume = sum of layer.volume across all elements using this material
```

### Step 1.3: Persist volumes to DB

**File:** `v2/src/app/api/projects/[id]/upload/route.ts`

Already handled — the upload route stores `mat.totalVolume` and `elementMaterials.volume`. Once bridge.ts populates real values, they flow through automatically.

### Step 1.4: Verify end-to-end

After this phase: upload an IFC file → materials table shows real volumes (m³) → `elementMaterials` table has per-layer volumes.

---

## Phase 2: LCA Calculation Engine (Core Value)

**Why:** Without this, V2 shows raw indicator factors (per kg) but never multiplies by actual mass. Users see nonsensical numbers.

### Step 2.1: Trigger calculations after matching

**File:** New `v2/src/app/api/projects/[id]/calculate/route.ts`

Create a `POST /api/projects/[id]/calculate` endpoint that:

1. Fetches all `elementMaterials` for the project (joined with `materials` and `lcaMaterials`)
2. For each elementMaterial row where `materialId` has a match:
   - `mass = volume × density`
   - `gwpTotal = mass × lcaMaterial.gwpTotal`
   - `penreTotal = mass × lcaMaterial.penreTotal`
   - `ubp = mass × lcaMaterial.ubp`
3. Batch-updates `elementMaterials` rows with calculated values
4. Aggregates per-element: sum all layers → update `elements.gwpTotal_cached`, `elements.penreTotal_cached`, `elements.ubp_cached`
5. Aggregates per-project: sum all elements → update `projects.gwpTotal_cached`, `projects.penreTotal_cached`, `projects.ubpTotal_cached`, `projects.emissionsCalculatedAt`
6. Returns calculated totals

### Step 2.2: Auto-trigger calculation after match changes

**Files:**
- `v2/src/app/api/materials/match/route.ts` — after manual match, call calculate
- `v2/src/app/api/materials/auto-match/route.ts` — after all auto-matches done, call calculate
- `v2/src/app/api/materials/unmatch/route.ts` — after unmatch, recalculate

Rather than calling a separate endpoint, extract calculation logic into a shared function:

**File:** `v2/src/lib/lca/calculations-server.ts`

```typescript
export async function recalculateProject(projectId: string): Promise<ProjectEmissions> {
  // 1. Fetch all elementMaterials with joins
  // 2. Calculate per-layer indicators
  // 3. Batch update elementMaterials, elements, project
  // 4. Return totals
}
```

### Step 2.3: Display calculated emissions in UI

**File:** `v2/src/components/panels/bottom-panel.tsx`

Currently the totals row sums raw indicator factors. Change to:
- Per material: `volume × density × factor` (use `calculateLayerIndicators` from `calculations.ts`)
- Totals row: sum of per-material calculated values
- Show actual kg CO₂-eq, not factor per kg

**File:** `v2/src/components/panels/project-summary.tsx`

Update emission totals to use server-calculated cached values from `project.gwpTotal_cached`.

### Step 2.4: Wire heatmap to calculated values

**File:** `v2/src/components/viewer/ifc-viewer.tsx` (or wherever heatmap coloring is applied)

The store already has `colorMode` and `heatmapIndicator`. `computeHeatmapData()` in `calculations.ts` is ready. Need to:

1. After calculation, build `Map<guid, number>` from `elements.gwpTotal_cached`
2. Pass to renderer's coloring API
3. Show color legend

---

## Phase 3: Charts & Visualization

**Why:** V1's chart page was heavily used. Users need to see GWP breakdown by category, element type, material to identify where to optimize.

### Step 3.1: Chart data aggregation API

**File:** New `v2/src/app/api/projects/[id]/emissions/route.ts`

Returns pre-aggregated emission data:
```typescript
{
  totals: { gwp, ubp, penre },
  byCategory: [{ category, gwp, ubp, penre }],
  byElementType: [{ type, gwp, ubp, penre }],
  byMaterial: [{ name, gwp, ubp, penre, volume, density }],
  relative?: { gwpPerM2Year, ubpPerM2Year, penrePerM2Year } // if area set
}
```

### Step 3.2: Chart components

**File:** New `v2/src/components/charts/emissions-chart.tsx`

Install `recharts` (already in v1's deps).

Implement chart types:
- **Bar chart** — horizontal bars: GWP by material or category (default view)
- **Pie/Donut chart** — proportional breakdown
- **Stacked bar** — multiple indicators side by side

Props:
```typescript
interface EmissionsChartProps {
  data: EmissionsByCategory[] | EmissionsByMaterial[];
  indicator: IndicatorKey; // gwpTotal | penreTotal | ubp
  chartType: "bar" | "pie" | "stacked";
  groupBy: "category" | "material" | "elementType";
}
```

### Step 3.3: Integrate into project page

**File:** `v2/src/components/panels/project-summary.tsx`

Replace the static "Environmental Indicators" section with interactive charts.

Add tabs or a dropdown:
- Summary (current text stats)
- GWP breakdown (bar chart)
- By category (pie chart)
- By element type (bar chart)

### Step 3.4: Indicator selector

Allow switching between GWP, UBP, PENRE for all chart views. V2 already has `heatmapIndicator` in the store — reuse for charts.

---

## Phase 4: IFC Export with Embedded Results

**Why:** This is V1's unique value proposition — writing LCA results back into the BIM model so other tools can consume them.

### Step 4.1: Server-side IFC processing

V1 used Pyodide + IfcOpenShell (Python in browser, 30MB). V2 should use a server-side approach.

**Option A (Recommended):** Use `ifc-lite`'s write capabilities if available. Check `@ifc-lite/parser` API for property set writing.

**Option B:** Use a lightweight server-side IFC library (e.g., `web-ifc` or `ifc-openshell` Node bindings) to read the original IFC, add `CPset_IfcLCA` property sets, and write back.

**Option C:** Binary patch approach — parse IFC STEP file as text, append property set definitions at known anchor points. This avoids heavy deps but is fragile.

### Step 4.2: Export API endpoint

**File:** New `v2/src/app/api/projects/[id]/export/route.ts`

`POST /api/projects/[id]/export`

Body: IFC file (binary) from client's IndexedDB cache.

Flow:
1. Accept original IFC file
2. Fetch all elements with calculated indicators from DB
3. For each element (matched by GUID):
   - Create `IfcPropertySet` named `CPset_IfcLCA`
   - Add properties: `GWP` (real), `UBP` (real), `PENRE` (real)
   - Link to element via `IfcRelDefinesByProperties`
4. Return modified IFC as download

### Step 4.3: Export UI

**File:** New `v2/src/components/export/export-dialog.tsx`

- Button in project header or summary panel: "Export IFC with Results"
- Dialog:
  - Upload original IFC (or use cached version from IndexedDB)
  - Show preview: X elements will get results, Y are missing
  - Download enriched IFC file

---

## Phase 5: Calculation Area & Relative Emissions

**Why:** Comparing absolute emissions between buildings of different sizes is meaningless. Per-m²-per-year normalization is standard practice.

### Step 5.1: Project settings for area

**File:** `v2/src/app/api/projects/[id]/route.ts` — add PATCH support

The DB schema already has `areaType`, `areaValue`, `areaUnit`, `amortization` on the projects table.

Add a PATCH endpoint to update these fields.

### Step 5.2: Project settings UI

**File:** New `v2/src/components/project/project-settings.tsx`

Accessible from project header (gear icon or inline):
- Area type dropdown: EBF, GFA, NFA, GIA
- Area value: number input (m²)
- Amortization period: number input (years, default 50)
- Project name (editable)
- Project description (optional)

### Step 5.3: Relative emissions display

**File:** `v2/src/components/panels/project-summary.tsx`

If `project.areaValue > 0`:
- Show additional row: "GWP per m²·a" = `gwpTotal / (area × amortization)`
- Same for UBP, PENRE
- Swiss SIA 2040 target comparison (optional): show how the building compares to the target path

### Step 5.4: `relativeEmission()` is already implemented

`v2/src/lib/lca/calculations.ts` already exports `relativeEmission(absolute, area, amortization)`. Just wire it to the UI.

---

## Phase 6: Project Management & History

### Step 6.1: Project edit page

**File:** Extend `v2/src/app/api/projects/[id]/route.ts` with PATCH

**File:** Add inline editing to `v2/src/components/project/project-client.tsx`

- Click project name → inline edit
- Settings panel (area, amortization, data source) — accessible from header

### Step 6.2: Upload history

**File:** The `uploads` table already exists with `filename`, `fileSize`, `status`, `elementCount`, `materialCount`, `createdAt`.

**File:** New component `v2/src/components/project/upload-history.tsx`

Show list of uploads for the project:
- Filename, size, date, element/material count, status badge
- Accessible from project header or summary panel

### Step 6.3: Dashboard improvements

**File:** `v2/src/components/dashboard/dashboard-client.tsx`

Add summary stats at the top:
- Total projects
- Total elements across all projects
- Total materials across all projects
- Aggregate GWP (from `projects.gwpTotal_cached`)

Project cards should show:
- Material match progress (X/Y matched)
- Total GWP if calculated
- Last activity date

### Step 6.4: Activity feed (optional, lower priority)

**Approach:** Add a lightweight `activities` table or use the existing data (uploads, material changes) to derive activity timeline.

Schema:
```sql
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  projectId TEXT REFERENCES projects(id),
  userId TEXT NOT NULL,
  type TEXT NOT NULL, -- 'upload', 'match', 'unmatch', 'calculate', 'export'
  detail TEXT,        -- JSON payload
  createdAt INTEGER DEFAULT (unixepoch())
);
```

Insert activity records in existing API routes (upload, match, unmatch, calculate, export).

Display in dashboard sidebar or project summary.

---

## Phase 7: Print/PDF Export

### Step 7.1: Print-optimized layouts

**File:** New `v2/src/components/print/print-layout.tsx`

CSS `@media print` styles for:
- Project header (name, date, area)
- Emissions summary table
- Charts (rendered as static images via Recharts `<ResponsiveContainer>`)
- Materials table (all rows, not paginated)

### Step 7.2: Print button

Add "Print Report" button to project summary or header.

On click:
1. Render print layout in a hidden div
2. Call `window.print()`
3. Browser native print dialog handles PDF generation

### Step 7.3: Chart image export (optional)

Recharts supports `toBase64Image()` for chart export. Could offer "Download Chart as PNG" alongside print.

---

## Implementation Order & Dependencies

```
Phase 1 (Volumes)     ←── Foundation, everything depends on this
  ↓
Phase 2 (Calculations) ←── Core value, needs volumes
  ↓
Phase 3 (Charts)       ←── Visualization, needs calculations
Phase 4 (IFC Export)   ←── Can start in parallel with Phase 3
Phase 5 (Area/Relative)←── Needs calculations, small scope
  ↓
Phase 6 (Project Mgmt) ←── Independent, can start anytime
Phase 7 (Print/PDF)    ←── Needs charts
```

**Parallelizable:**
- Phase 3 + Phase 4 can run in parallel (charts vs export)
- Phase 5 + Phase 6 can run in parallel (both small scope)
- Phase 6 is fully independent — can start at any point

---

## Files to Create

| File | Purpose |
|------|---------|
| `v2/src/app/api/projects/[id]/calculate/route.ts` | Trigger LCA calculation |
| `v2/src/app/api/projects/[id]/emissions/route.ts` | Aggregated emission data for charts |
| `v2/src/app/api/projects/[id]/export/route.ts` | IFC export with embedded results |
| `v2/src/lib/lca/calculations-server.ts` | Server-side calculation logic (DB writes) |
| `v2/src/components/charts/emissions-chart.tsx` | Recharts-based visualization |
| `v2/src/components/project/project-settings.tsx` | Area, amortization, name editing |
| `v2/src/components/project/upload-history.tsx` | Upload history list |
| `v2/src/components/export/export-dialog.tsx` | IFC export dialog |
| `v2/src/components/print/print-layout.tsx` | Print-optimized report layout |

## Files to Modify

| File | Changes |
|------|---------|
| `v2/src/lib/ifc/bridge.ts` | Extract real volumes from geometry/properties |
| `v2/src/app/api/materials/match/route.ts` | Trigger recalculation after match |
| `v2/src/app/api/materials/auto-match/route.ts` | Trigger recalculation after all matches |
| `v2/src/app/api/materials/unmatch/route.ts` | Trigger recalculation after unmatch |
| `v2/src/app/api/projects/[id]/route.ts` | Add PATCH for project editing |
| `v2/src/components/panels/bottom-panel.tsx` | Show calculated emissions, not raw factors |
| `v2/src/components/panels/project-summary.tsx` | Charts, relative emissions, settings |
| `v2/src/components/project/project-client.tsx` | Project editing, export button, settings |
| `v2/src/components/dashboard/dashboard-client.tsx` | Stats, project card details |
| `v2/src/lib/store/app-store.ts` | Calculation state, chart data |
