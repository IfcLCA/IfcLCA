# IfcLCA v2 — Architecture Redesign Plan

## Executive Summary

A ground-up rethink of IfcLCA, replacing the current form-heavy, table-driven workflow with a **3D-model-centric** application built on **ifc-lite** for IFC processing and rendering, with a **pluggable data source architecture** supporting KBOB, Ökobaudat, and future LCA databases.

---

## Part 1: Analysis of the Current System

### Current Architecture (What We Have)

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │ File Upload  │───▸│ IfcOpenShell via Pyodide  │   │
│  │ (dropzone)   │    │ (WASM, ~30MB download)    │   │
│  └─────────────┘    └──────────┬───────────────┘   │
│                                │ parsed elements    │
│                                ▼                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ POST /api/projects/[id]/upload/process       │   │
│  │ (sends JSON metadata — no geometry)          │   │
│  └──────────────────────┬──────────────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│  Server (Next.js API Routes + MongoDB)              │
│                                                     │
│  Materials ◄──── Auto-match ────▸ KBOB (lcadata.ch) │
│  Elements  ◄──── Bulk create ──▸ MongoDB            │
│  Projects  ◄──── Aggregate  ───▸ Emissions totals   │
│                                                     │
│  3D Viewer: placeholder (no IFC geometry rendered)  │
└─────────────────────────────────────────────────────┘
```

### Current Data Flow

1. User drops `.ifc` file into upload modal
2. **IfcOpenShell (Pyodide/WASM)** parses client-side — extracts elements, materials, volumes, classifications
3. Parsed metadata (no geometry) sent to server API
4. Server creates Material + Element documents in MongoDB
5. Auto-matching runs against KBOB database (exact/case-insensitive name match)
6. User manually matches remaining materials in Materials Library page
7. Emissions calculated: `volume × density × indicator_factor`
8. Results shown in tables and Recharts bar charts

### Current Pain Points

| Problem | Impact |
|---------|--------|
| **No 3D viewer** | Users can't see *what* they're analyzing — disconnect between model and data |
| **Pyodide/IfcOpenShell WASM is ~30MB** | Slow initial load, large bundle, fragile WASM dependency chain |
| **Only KBOB** | Locked to Swiss data, no German/EU support |
| **KBOB-specific fields hardcoded everywhere** | `gwpTotal`, `ubp21Total`, `primaryEnergyNonRenewableTotal` baked into models, services, UI |
| **Material matching is name-based only** | No classification-based matching, no ML/fuzzy matching |
| **No geometry stored** | Can't highlight elements, can't do spatial queries |
| **Table-heavy UI** | Material library and emissions views are dense data tables with no visual context |
| **MongoDB for everything** | Works, but heavy for what could be a more lightweight, file-based approach |

---

## Part 2: ifc-lite — What It Gives Us

### Capabilities

| Feature | ifc-lite | Current (IfcOpenShell WASM) |
|---------|----------|---------------------------|
| **Bundle size** | ~260 KB gzipped | ~30 MB (Pyodide + IfcOpenShell) |
| **Parse speed (10MB file)** | 100-200ms | Several seconds |
| **Parse speed (50MB file)** | 600-700ms | 10+ seconds |
| **3D rendering** | WebGPU, built-in | None (placeholder) |
| **First triangles visible** | 300-500ms | N/A |
| **Memory efficiency** | Zero-copy WASM-to-GPU | Standard JS objects |
| **IFC versions** | IFC4X3 (876 entities) + IFC5/IFCX | IFC2X3/IFC4 |
| **2D drawings** | Sections, floor plans, elevations | None |
| **Data structures** | Columnar TypedArrays | Plain JS objects |
| **Multi-model** | Built-in federation | Not supported |
| **Export** | glTF, Parquet, IFC | None |
| **Property editing** | Mutation tracking | Read-only |
| **Deployment** | Browser, Server (Rust), Desktop (Tauri) | Browser only |

### Package Architecture (18 npm packages)

**Essential for IfcLCA v2:**
- `@ifc-lite/parser` — Parse IFC files, extract entities and properties
- `@ifc-lite/geometry` — Generate GPU-ready triangle meshes
- `@ifc-lite/renderer` — WebGPU 3D viewer with selection, highlighting
- `@ifc-lite/query` — Query entities by type, property, relationship
- `@ifc-lite/data` — Columnar data structures for efficient traversal
- `@ifc-lite/spatial` — Spatial indexing for click-to-select

**Useful later:**
- `@ifc-lite/export` — glTF/Parquet export
- `@ifc-lite/bcf` — BIM collaboration (issue tracking on model)
- `@ifc-lite/drawing-2d` — Section cuts, floor plans
- `@ifc-lite/cache` — Binary cache for repeat access
- `@ifc-lite/ids` — IDS validation (data quality checks)

---

## Part 3: The New Paradigm — 3D Model as Centerpiece

### Design Philosophy

> **The 3D model IS the interface.** Everything — material assignment, emissions visualization, data source selection — happens in context of the model. Tables and forms exist as secondary detail views, not the primary workflow.

### Core UX Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  IfcLCA v2                                                      │
│                                                                 │
│  ┌───────────────────────────────────────┐ ┌─────────────────┐ │
│  │                                       │ │  Context Panel  │ │
│  │           3D MODEL VIEWER             │ │                 │ │
│  │         (ifc-lite/renderer)           │ │  Changes based  │ │
│  │                                       │ │  on selection   │ │
│  │   Click element → see its materials   │ │  and mode:      │ │
│  │   Click material → highlight all      │ │                 │ │
│  │   Color by GWP/UBP/PENRE heatmap     │ │  • Element info │ │
│  │   Color by match status               │ │  • Material map │ │
│  │   Color by data source                │ │  • Emissions    │ │
│  │                                       │ │  • Data source  │ │
│  │                                       │ │                 │ │
│  └───────────────────────────────────────┘ └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Bottom Bar: Summary stats | Data source selector | Export  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Model

1. **Load IFC** → 3D model renders in <1s, elements colored by match status (green=matched, amber=partial, red=unmatched)
2. **Click element** → Context panel shows: element type, layers, materials, current LCA match, emissions
3. **Click material layer** → All elements with that material highlight in viewer, context panel shows matching options
4. **Match material** → Select from data source (KBOB/Ökobaudat/etc.), see emissions update live on model
5. **Color modes** → Toggle between: match status, GWP heatmap, UBP heatmap, PENRE heatmap, element type, data source
6. **Aggregate views** → Summary panel (collapsible) shows project totals, per-category breakdowns, charts

---

## Part 4: Pluggable Data Source Architecture

### The Problem

Currently, KBOB is hardcoded throughout:
- `KBOBMaterial` model with KBOB-specific fields (`ubp21Total`, `gwpTotal`, etc.)
- `kbobMatchId` on Material model
- `findBestKBOBMatch()` — KBOB-only matching
- UI components reference KBOB by name
- Indicator helpers assume exactly 3 KBOB indicators

### The Solution: Adapter Pattern

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer                                      │
│                                                         │
│  Materials, Elements, Calculations                      │
│  ↕ uses only NormalizedMaterial + NormalizedIndicators   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Data Source Registry                                   │
│                                                         │
│  register(adapter: LCADataSource)                       │
│  getSource(id: string): LCADataSource                   │
│  getAllSources(): LCADataSource[]                        │
│  search(query, sourceIds?): NormalizedMaterial[]         │
│                                                         │
├─────────────┬──────────────┬──────────────┬─────────────┤
│  KBOB       │  Ökobaudat   │  INIES       │  Custom     │
│  Adapter    │  Adapter     │  Adapter     │  Adapter    │
│             │              │              │             │
│  lcadata.ch │  oekobaudat  │  inies.fr    │  CSV/JSON   │
│  JSON API   │  .de ILCD    │  webservice  │  upload     │
└─────────────┴──────────────┴──────────────┴─────────────┘
```

### Normalized Data Types

```typescript
// === Core normalized types (database-agnostic) ===

interface NormalizedMaterial {
  id: string;                    // Internal ID
  sourceId: string;              // ID in the origin database
  source: string;                // "kbob" | "oekobaudat" | "inies" | ...

  name: string;                  // Display name (localized)
  nameOriginal?: string;         // Name in source language
  category: string;              // Normalized category
  categoryOriginal?: string;     // Category in source system

  density: number | null;        // kg/m³
  unit: string;                  // Reference unit

  indicators: LCAIndicators;     // Normalized environmental indicators

  metadata: {
    version: string;             // Source database version
    lastUpdated: Date;           // When this record was synced
    validUntil?: Date;           // Expiry for EPDs
    scope?: string;              // e.g., "A1-A3", "A1-D"
    standard?: string;           // e.g., "EN 15804+A2"
  };
}

interface LCAIndicators {
  // EN 15804 core indicators (universal)
  gwpTotal: number | null;       // kg CO₂-eq (GWP-total)
  gwpFossil?: number | null;     // kg CO₂-eq (GWP-fossil)
  gwpBiogenic?: number | null;   // kg CO₂-eq (GWP-biogenic)
  gwpLuluc?: number | null;      // kg CO₂-eq (GWP-luluc)

  penreTotal: number | null;     // MJ (primary energy, non-renewable)
  pereTotal?: number | null;     // MJ (primary energy, renewable)

  ap?: number | null;            // mol H+ eq (acidification)
  odp?: number | null;           // kg CFC-11 eq (ozone depletion)
  pocp?: number | null;          // kg NMVOC eq (smog)
  adpMineral?: number | null;    // kg Sb eq (abiotic depletion, minerals)
  adpFossil?: number | null;     // MJ (abiotic depletion, fossil)

  // Database-specific indicators (stored but not assumed)
  ubp?: number | null;           // UBP points (KBOB-specific)

  // Extension point
  custom?: Record<string, number | null>;
}

// === Data source adapter interface ===

interface LCADataSource {
  id: string;                    // "kbob", "oekobaudat", etc.
  name: string;                  // Display name
  region: string;                // "CH", "DE", "FR", "EU", ...
  url: string;                   // Source website

  // Capabilities
  availableIndicators(): string[];  // Which LCAIndicators fields this source provides
  supportsSearch(): boolean;
  supportsPagination(): boolean;

  // Data operations
  fetchAll(): Promise<NormalizedMaterial[]>;
  search(query: string, filters?: SearchFilters): Promise<NormalizedMaterial[]>;
  getById(sourceId: string): Promise<NormalizedMaterial | null>;

  // Sync
  getLastSyncTime(): Promise<Date | null>;
  sync(): Promise<SyncResult>;
}

interface SearchFilters {
  category?: string;
  minDensity?: number;
  maxDensity?: number;
  hasIndicator?: string[];       // e.g., ["gwpTotal", "penreTotal"]
}

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
  timestamp: Date;
}
```

### Per-Database Adapter Notes

**KBOB Adapter:**
- Source: `https://www.lcadata.ch/api/kbob/materials?pageSize=all`
- Auth: Bearer token
- Format: JSON (flat)
- Maps: `gwpTotal` → `indicators.gwpTotal`, `ubp21Total` → `indicators.ubp`, `primaryEnergyNonRenewableTotal` → `indicators.penreTotal`
- Unique: provides UBP (Swiss eco-points)

**Ökobaudat Adapter:**
- Source: `https://oekobaudat.de/OEKOBAU.DAT/resource/datastocks/{id}/processes`
- Auth: API access (details via their developer portal)
- Format: ILCD+EPD (XML default, JSON with `format=JSON`)
- Maps: Full EN 15804+A2 indicators (all GWP variants, AP, ODP, POCP, etc.)
- Unique: most comprehensive indicator set, supports compliance filtering (+A1 vs +A2)

**Future: INIES Adapter:**
- Source: INIES webservice
- Format: ILCD-based
- Maps: EN 15804+A2 + French national extensions
- Unique: FDES (construction products) + PEP (equipment)

**Future: Custom/CSV Adapter:**
- Allow users to upload their own material databases
- CSV/JSON with mapped columns
- Supports manufacturer-specific EPDs

---

## Part 5: New Application Architecture

### Tech Stack Changes

| Layer | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| **IFC parsing** | IfcOpenShell via Pyodide (~30MB) | `@ifc-lite/parser` (~260KB) | 100x smaller, 5x faster |
| **3D rendering** | None (placeholder) | `@ifc-lite/renderer` (WebGPU) | First-class 3D viewer |
| **IFC querying** | Custom Python scripts in WASM | `@ifc-lite/query` | Native JS, typed API |
| **Framework** | Next.js 15 (App Router) | Next.js (App Router) | Keep — works well |
| **Database** | MongoDB + Mongoose | Consider lighter options (see below) | TBD based on requirements |
| **Auth** | Clerk | Clerk | Keep — works well |
| **State mgmt** | React hooks + minimal Zustand | Zustand (expanded) | Need shared state for viewer ↔ panels |
| **Charts** | Recharts | Recharts or similar | Keep or upgrade |
| **Styling** | Tailwind + Radix | Tailwind + Radix | Keep — works well |

### Database Strategy: Options

**Option A: Keep MongoDB (lower risk)**
- Replace `KBOBMaterial` collection with generic `LCASource` collection
- Add `source` discriminator field
- Keep existing Material/Element/Project models
- Replace `kbobMatchId` with `lcaMatchId` + `lcaMatchSource`

**Option B: Hybrid (MongoDB + client-side cache)**
- MongoDB for projects, materials, elements (server-side persistence)
- IndexedDB/ifc-lite cache for IFC geometry (client-side, avoids uploading models)
- Parquet export via `@ifc-lite/export` for data interchange

**Option C: Lighter backend (higher risk, more rewrite)**
- SQLite/Turso for structured data (projects, materials, matches)
- S3-compatible storage for cached IFC data
- Potential for fully client-side with sync

**Recommendation: Option B** — MongoDB handles what it's good at (documents, user data, LCA sources), while ifc-lite handles geometry client-side.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  @ifc-lite/parser + geometry + renderer              │       │
│  │                                                      │       │
│  │  • Parse IFC file → columnar data + triangle mesh    │       │
│  │  • Render 3D model via WebGPU                        │       │
│  │  • Spatial queries (click-to-select)                 │       │
│  │  • Color-coding by emissions / match status          │       │
│  │  • Cache parsed model in IndexedDB                   │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────┐       │
│  │  Application State (Zustand)                         │       │
│  │                                                      │       │
│  │  • selectedElements: Set<string>                     │       │
│  │  • colorMode: "matchStatus" | "gwp" | "ubp" | ...   │       │
│  │  • activeDataSource: string                          │       │
│  │  • materialMatches: Map<materialName, LCAMatch>      │       │
│  │  • emissions: ProjectEmissions                       │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────┐       │
│  │  UI Layer                                            │       │
│  │                                                      │       │
│  │  ┌────────────┐ ┌──────────┐ ┌───────────────────┐  │       │
│  │  │ 3D Viewer  │ │ Context  │ │  Summary / Charts │  │       │
│  │  │ (main)     │ │ Panel    │ │  (collapsible)    │  │       │
│  │  └────────────┘ └──────────┘ └───────────────────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                         │                                        │
│                         │  API calls (metadata only)             │
│                         ▼                                        │
├──────────────────────────────────────────────────────────────────┤
│  SERVER (Next.js API Routes)                                     │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Projects    │  │  Materials   │  │  Data Source Registry  │ │
│  │  API         │  │  Matching    │  │                        │ │
│  │              │  │  API         │  │  ┌──────┐ ┌─────────┐ │ │
│  │  CRUD +     │  │              │  │  │ KBOB │ │Ökobaudat│ │ │
│  │  emissions  │  │  match()     │  │  └──────┘ └─────────┘ │ │
│  │  aggregation│  │  search()    │  │  ┌──────┐ ┌─────────┐ │ │
│  │              │  │  preview()   │  │  │INIES │ │ Custom  │ │ │
│  └──────┬──────┘  └──────┬───────┘  │  └──────┘ └─────────┘ │ │
│         │                │           └────────────┬───────────┘ │
│         ▼                ▼                        ▼             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  MongoDB                                                    ││
│  │                                                             ││
│  │  projects | materials | elements | lca_sources | uploads    ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 6: New Data Model

### MongoDB Collections (Redesigned)

#### `projects`
```
{
  _id, userId, name, description, imageUrl,
  classificationSystem: "eBKP-H" | "Uniclass" | ...,
  calculationArea: { type, value, unit },
  preferredDataSource: "kbob" | "oekobaudat" | ...,  // NEW
  emissions: {
    gwpTotal, penreTotal, ubp,                         // Normalized names
    byCategory: { ... },                               // Per-eBKP breakdown
    lastCalculated
  }
}
```

#### `elements`
```
{
  _id, projectId, uploadId, guid, name, type,
  loadBearing, isExternal,
  classification: { system, code, name },
  materials: [{
    material: ObjectId,            // ref → materials
    volume: Number,
    fraction: Number,
    thickness?: Number,
    indicators: {                  // Pre-calculated
      gwpTotal, penreTotal, ubp,
      // Future: ap, odp, pocp, ...
    }
  }]
}
```

#### `materials`
```
{
  _id, projectId, name, category, density, volume,

  // CHANGED: generic LCA match instead of kbobMatchId
  lcaMatch: {
    sourceId: String,              // ID in source database
    source: String,                // "kbob" | "oekobaudat" | ...
    materialId: ObjectId,          // ref → lca_sources
    matchScore: Number,            // 0-1 confidence
    matchMethod: String,           // "auto" | "manual" | "classification"
    matchedAt: Date
  }
}
```

#### `lca_sources` (replaces `indicatorsKBOB`)
```
{
  _id,
  source: "kbob" | "oekobaudat" | "inies" | ...,
  sourceId: String,                // uuid in source DB

  name: String,                    // Display name (localized)
  nameOriginal: String,            // Original language
  category: String,

  density: Number,
  unit: String,

  indicators: {
    gwpTotal, gwpFossil?, gwpBiogenic?, gwpLuluc?,
    penreTotal, pereTotal?,
    ubp?,                          // KBOB only
    ap?, odp?, pocp?,              // Ökobaudat/INIES
    adpMineral?, adpFossil?,
    custom?: {}
  },

  metadata: {
    version, lastSynced, validUntil?, scope?, standard?
  }
}
// Index: { source: 1, sourceId: 1 } unique
// Index: { source: 1, name: "text" } for search
```

### What Changes vs. Current

| Aspect | Current | New |
|--------|---------|-----|
| KBOB collection | `indicatorsKBOB` with KBOB-specific schema | `lca_sources` with generic schema + `source` discriminator |
| Material match reference | `kbobMatchId: ObjectId` | `lcaMatch: { source, sourceId, materialId, matchScore }` |
| Indicators on elements | `{ gwp, ubp, penre }` | `{ gwpTotal, penreTotal, ubp?, ap?, ... }` — extensible |
| Indicator helpers | `getGWP()`, `getUBP()`, `getPENRE()` | `getIndicator(material, "gwpTotal")` — generic |
| Project emissions | `{ gwp, ubp, penre }` | Same pattern but normalized field names + extensible |

---

## Part 7: New User Flow

### Flow 1: New Project

```
1. Create Project
   └─ Set name, description, preferred data source (KBOB/Ökobaudat/...)

2. Upload IFC
   └─ Drag & drop .ifc file
   └─ ifc-lite parses client-side in <1 second
   └─ 3D model renders immediately (WebGPU)
   └─ Elements colored RED (unmatched)

3. Extract & Send Metadata
   └─ ifc-lite/query extracts: elements, materials, volumes, classifications
   └─ Metadata (not geometry!) sent to server
   └─ Server creates Material + Element records
   └─ Auto-matching runs against preferred data source

4. Model Updates Live
   └─ Matched elements turn GREEN
   └─ Partially matched turn AMBER
   └─ Remaining stay RED
   └─ Context panel shows match summary

5. Manual Matching (for unmatched materials)
   └─ Click RED element → context panel shows material + suggestions
   └─ Search across data sources (KBOB, Ökobaudat, custom)
   └─ Select match → element + all same-material elements update color
   └─ Emissions recalculate in real-time

6. Analysis
   └─ Toggle color mode: GWP heatmap, PENRE heatmap, etc.
   └─ Hotspots visible immediately on 3D model
   └─ Click elements to drill into indicators
   └─ Summary panel shows project totals + per-category charts
   └─ Compare indicators across data sources (side-by-side)
```

### Flow 2: Multi-Model (Federation)

```
1. Upload multiple IFC files (structural + MEP + architectural)
2. ifc-lite federates into unified scene
3. Select across models seamlessly
4. Materials matched independently per model or globally
5. Emissions aggregated across all models
```

### Flow 3: Data Source Switching

```
1. Project currently using KBOB
2. User switches to Ökobaudat (for German context)
3. System shows which materials have equivalent matches
4. Auto-rematch where possible
5. Flag materials needing manual review
6. Emissions recalculate with new source's indicators
7. Side-by-side comparison view: KBOB vs Ökobaudat results
```

---

## Part 8: Component Architecture

### Page Structure

```
/                          → Landing page (keep)
/dashboard                 → Project list + stats (simplify)
/project/[id]              → THE main page (3D viewer + everything)
/project/[id]/compare      → Compare data sources side-by-side
/project/[id]/report       → Export / print report
/settings                  → Data source config, API keys
```

The key change: **`/project/[id]` is now ONE page** — not separate pages for materials, emissions, upload history, etc. Everything is accessible from the 3D viewer context.

### Component Hierarchy

```
ProjectPage
├── ViewerContainer
│   ├── IFCViewer (ifc-lite/renderer)
│   │   ├── ColorOverlay (heatmaps, match status)
│   │   ├── SelectionHighlight
│   │   └── ViewerControls (orbit, zoom, section cut)
│   └── ViewerToolbar
│       ├── ColorModeSelector
│       ├── VisibilityToggles (by type, by storey)
│       └── SectionCutTool
│
├── ContextPanel (right sidebar, reactive to selection)
│   ├── ElementDetail (when element selected)
│   │   ├── ElementProperties
│   │   ├── MaterialLayers
│   │   └── ElementEmissions
│   ├── MaterialDetail (when material selected)
│   │   ├── MaterialProperties
│   │   ├── LCAMatchSelector
│   │   │   ├── DataSourceTabs (KBOB | Ökobaudat | ...)
│   │   │   ├── SearchBar
│   │   │   └── MatchResults
│   │   └── AffectedElements (list + highlight in viewer)
│   └── ProjectSummary (when nothing selected)
│       ├── MatchProgress (X/Y materials matched)
│       ├── EmissionsTotals
│       └── QuickActions
│
├── BottomPanel (collapsible)
│   ├── EmissionsChart (bar chart by category)
│   ├── MaterialsTable (sortable, filterable)
│   └── DataSourceInfo (active source, last sync, indicator coverage)
│
└── Dialogs
    ├── UploadDialog (drag & drop IFC)
    ├── DataSourceSettings
    └── ExportDialog (PDF report, CSV, Parquet)
```

### Zustand Store Structure

```typescript
interface AppStore {
  // Viewer state
  model: ParsedIFCModel | null;
  selectedElementIds: Set<string>;
  hoveredElementId: string | null;
  colorMode: "matchStatus" | "gwp" | "penre" | "ubp" | "type" | "source";
  visibilityFilters: { byType: Record<string, boolean>; byStorey: Record<string, boolean> };

  // Project data
  project: Project | null;
  elements: Element[];
  materials: Material[];

  // LCA data
  activeDataSource: string;
  materialMatches: Map<string, LCAMatch>;
  emissions: ProjectEmissions;

  // UI state
  contextPanelMode: "element" | "material" | "summary";
  bottomPanelOpen: boolean;

  // Actions
  selectElement(id: string): void;
  matchMaterial(materialId: string, lcaSourceId: string): void;
  setColorMode(mode: ColorMode): void;
  switchDataSource(sourceId: string): void;
}
```

---

## Part 9: Matching Algorithm Improvements

### Current (Name-Only)

```
1. Exact name match → score 1.0
2. Case-insensitive match → score 0.99
3. Nothing else
```

### Proposed (Multi-Signal)

```
1. Classification-based match (eBKP-H code → material category)    → score 0.95
2. Exact name match                                                 → score 1.0
3. Normalized name match (strip prefixes, suffixes, numbers)        → score 0.9
4. Fuzzy name match (Levenshtein / trigram similarity)              → score 0.7-0.9
5. Property-based match (density + category heuristics)             → score 0.6-0.8
6. Cross-source match (if matched in KBOB, find Ökobaudat equiv)   → score varies
7. User confirmation required for score < 0.9
```

### Classification Mapping

Build a mapping table: `eBKP-H code → material category → likely LCA materials`

Example:
```
C 2.1 (Exterior walls, masonry) → category: "masonry"
  → KBOB candidates: "Backstein", "Kalksandstein", "Ziegel"
  → Ökobaudat candidates: "Mauerziegel", "Kalksandstein", "Porenbeton"
```

This gives us a much better starting point than pure name matching.

---

## Part 10: Migration Strategy

### Phase 0: Foundation (Branch: current)
- [ ] Set up ifc-lite packages in project
- [ ] Create proof-of-concept: load IFC → render 3D → extract materials
- [ ] Verify ifc-lite can extract the same data IfcOpenShell currently extracts
- [ ] Design and implement `NormalizedMaterial` + `LCADataSource` interfaces
- [ ] Implement KBOB adapter using new interface (wrapping existing sync logic)

### Phase 1: Core Viewer
- [ ] Build `IFCViewer` component wrapping ifc-lite/renderer
- [ ] Implement element selection (click → highlight → show properties)
- [ ] Implement color-coding by match status
- [ ] Build `ContextPanel` with element detail view
- [ ] Wire up Zustand store for viewer ↔ panel communication

### Phase 2: Material Matching (Redesigned)
- [ ] Build `LCAMatchSelector` component (data source tabs, search, results)
- [ ] Implement improved matching algorithm (classification + fuzzy)
- [ ] Build `MaterialDetail` context panel view
- [ ] Live model color updates on match
- [ ] Migrate `materials` collection to use `lcaMatch` instead of `kbobMatchId`

### Phase 3: Ökobaudat Integration
- [ ] Implement Ökobaudat adapter (ILCD+EPD → NormalizedMaterial)
- [ ] Add Ökobaudat to data source registry
- [ ] Handle expanded indicator set (AP, ODP, POCP, etc.)
- [ ] UI for selecting/switching data sources per project
- [ ] Side-by-side comparison view

### Phase 4: Emissions & Visualization
- [ ] GWP/PENRE/UBP heatmap color modes on 3D model
- [ ] Bottom panel with aggregated charts (per category, per type)
- [ ] Relative emissions (per m²·a) with amortization
- [ ] Export: PDF report, CSV data, Parquet via ifc-lite

### Phase 5: Polish & Advanced Features
- [ ] Multi-model federation
- [ ] 2D section drawings via ifc-lite/drawing-2d
- [ ] BCF integration (annotate issues on model)
- [ ] Custom data source upload (CSV/JSON)
- [ ] IDS validation (check data completeness)

---

## Part 11: Key Technical Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **ifc-lite rendering target** | WebGPU only vs. WebGL fallback | WebGPU only (ifc-lite is WebGPU-native; fallback adds complexity) |
| **Geometry storage** | Server-side vs. client-side only | Client-side (IndexedDB + ifc-lite/cache) — keeps privacy-first approach |
| **Database migration** | In-place migration vs. fresh start | In-place: rename collection, add `source` field, migrate `kbobMatchId` → `lcaMatch` |
| **Material matching** | Client-side vs. server-side | Server-side (needs DB access for fuzzy search across sources) |
| **Indicator extensibility** | Fixed set vs. dynamic | Dynamic with "core" indicators (GWP, PENRE) always present, others optional |
| **Multi-model** | Single project = single model vs. multiple | Multiple models per project (federation) — enables architectural + structural + MEP |
| **Offline support** | Required vs. nice-to-have | Nice-to-have via ifc-lite/cache + service worker (Phase 5+) |

---

## Part 12: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **WebGPU browser support gaps** | Medium | High | Check ifc-lite's fallback story; consider WebGL shim if needed |
| **ifc-lite extracts different data than IfcOpenShell** | Medium | High | Phase 0 validation: compare extraction output for test IFC files |
| **Ökobaudat API complexity (ILCD+EPD XML)** | High | Medium | Start with JSON format param; build robust XML parser if needed |
| **Performance with large models (100MB+)** | Low | Medium | ifc-lite designed for this; streaming pipeline handles it |
| **Migration breaks existing user data** | Medium | High | Version the API; migration script for `kbobMatchId` → `lcaMatch` |
| **Indicator comparability across sources** | High | Medium | Clear UI labeling of source + scope; don't mix sources in same calculation |

---

## Summary: What Changes, What Stays

### Stays
- Next.js (App Router)
- Tailwind + Radix UI
- Clerk auth
- MongoDB (restructured)
- Privacy-first (no IFC upload to server)
- Core LCA calculation: `volume × density × indicator`

### Changes
- **IfcOpenShell/Pyodide → ifc-lite** (100x smaller, 5x faster, includes 3D)
- **No 3D viewer → 3D model as centerpiece** (WebGPU)
- **KBOB-only → pluggable data sources** (adapter pattern)
- **Multi-page workflow → single-page viewer** with context panels
- **Table-first UI → model-first UI** with tables as secondary views
- **Name-only matching → multi-signal matching** (classification, fuzzy, cross-source)
- **3 hardcoded indicators → extensible indicator system** (EN 15804 aligned)
- **Single model → multi-model federation support**
