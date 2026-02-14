/**
 * Drizzle ORM schema — single source of truth for all database tables.
 *
 * SQLite/Turso types: text, integer, real, blob
 * Timestamps stored as Unix epoch integers for SQLite compatibility.
 */

import { relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Helper: current Unix timestamp default
// ---------------------------------------------------------------------------
const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// LCA Materials (cached from KBOB, Ökobaudat, etc.)
// ---------------------------------------------------------------------------

export const lcaMaterials = sqliteTable(
  "lca_materials",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(), // "kbob", "oekobaudat"
    sourceId: text("source_id").notNull(),

    name: text("name").notNull(),
    nameOriginal: text("name_original"),
    category: text("category").default("Uncategorized"),
    categoryOriginal: text("category_original"),

    density: real("density"), // kg/m³
    unit: text("unit").default("kg"),

    // EN 15804 indicator values (per declared unit)
    gwpTotal: real("gwp_total"),
    gwpFossil: real("gwp_fossil"),
    gwpBiogenic: real("gwp_biogenic"),
    gwpLuluc: real("gwp_luluc"),
    penreTotal: real("penre_total"),
    pereTotal: real("pere_total"),
    ap: real("ap"),
    odp: real("odp"),
    pocp: real("pocp"),
    adpMineral: real("adp_mineral"),
    adpFossil: real("adp_fossil"),
    ubp: real("ubp"),

    // Metadata
    version: text("version").default("unknown"),
    lastSynced: integer("last_synced", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    validUntil: integer("valid_until", { mode: "timestamp" }),
    scope: text("scope"), // "A1-A3", "A1-D"
    standard: text("standard"), // "EN 15804+A2", "KBOB/ecobau/IPB"

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("lca_source_unique").on(t.source, t.sourceId),
    index("lca_source_idx").on(t.source),
    index("lca_category_idx").on(t.source, t.category),
    index("lca_name_idx").on(t.name),
  ]
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),

    classificationSystem: text("classification_system").default("eBKP-H"),
    preferredDataSource: text("preferred_data_source").default("kbob"),

    // Reference area for relative calculations
    areaType: text("area_type"),
    areaValue: real("area_value"),
    areaUnit: text("area_unit").default("m²"),

    // Amortization period in years
    amortization: integer("amortization").default(50),

    // Cached emission totals
    gwpTotal: real("gwp_total_cached"),
    penreTotal: real("penre_total_cached"),
    ubpTotal: real("ubp_total_cached"),
    emissionsCalculatedAt: integer("emissions_calculated_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("project_user_idx").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Uploads (IFC file history)
// ---------------------------------------------------------------------------

export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    filename: text("filename").notNull(),
    fileSize: integer("file_size"),
    status: text("status", {
      enum: ["processing", "completed", "failed"],
    }).default("processing"),
    elementCount: integer("element_count").default(0),
    materialCount: integer("material_count").default(0),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("upload_project_idx").on(t.projectId),
  ]
);

// ---------------------------------------------------------------------------
// Materials (unique per project, with optional LCA match)
// ---------------------------------------------------------------------------

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    category: text("category"),
    density: real("density"),
    totalVolume: real("total_volume").default(0),

    // LCA match (generic — works with any data source)
    lcaMaterialId: text("lca_material_id").references(() => lcaMaterials.id),
    matchSource: text("match_source"), // "kbob", "oekobaudat"
    matchSourceId: text("match_source_id"),
    matchScore: real("match_score"),
    matchMethod: text("match_method"), // "exact", "fuzzy", "manual", etc.
    matchedAt: integer("matched_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("material_project_name").on(t.projectId, t.name),
    index("material_project_idx").on(t.projectId),
    index("material_match_idx").on(t.lcaMaterialId),
  ]
);

// ---------------------------------------------------------------------------
// Elements (IFC building elements)
// ---------------------------------------------------------------------------

export const elements = sqliteTable(
  "elements",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    uploadId: text("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),

    guid: text("guid").notNull(), // IFC GlobalId
    name: text("name").notNull(),
    type: text("type").notNull(), // IfcWall, IfcSlab, etc.
    isLoadBearing: integer("is_load_bearing", { mode: "boolean" }).default(
      false
    ),
    isExternal: integer("is_external", { mode: "boolean" }).default(false),

    // Classification (e.g., eBKP-H)
    classificationSystem: text("classification_system"),
    classificationCode: text("classification_code"),
    classificationName: text("classification_name"),

    // Cached indicator totals for this element
    gwpTotal: real("gwp_total_cached"),
    penreTotal: real("penre_total_cached"),
    ubp: real("ubp_cached"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("element_project_guid").on(t.projectId, t.guid),
    index("element_project_idx").on(t.projectId),
    index("element_upload_idx").on(t.uploadId),
    index("element_type_idx").on(t.projectId, t.type),
  ]
);

// ---------------------------------------------------------------------------
// Element ↔ Material junction (with volume/fraction per layer)
// ---------------------------------------------------------------------------

export const elementMaterials = sqliteTable(
  "element_materials",
  {
    id: text("id").primaryKey(),
    elementId: text("element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),

    volume: real("volume").notNull(),
    fraction: real("fraction").notNull(),
    thickness: real("thickness"),

    // Calculated indicators for this specific layer
    gwpTotal: real("gwp_total"),
    penreTotal: real("penre_total"),
    ubp: real("ubp"),
  },
  (t) => [
    index("em_element_idx").on(t.elementId),
    index("em_material_idx").on(t.materialId),
  ]
);

// ---------------------------------------------------------------------------
// Relations (for Drizzle query builder)
// ---------------------------------------------------------------------------

export const projectRelations = relations(projects, ({ many }) => ({
  uploads: many(uploads),
  materials: many(materials),
  elements: many(elements),
}));

export const uploadRelations = relations(uploads, ({ one, many }) => ({
  project: one(projects, {
    fields: [uploads.projectId],
    references: [projects.id],
  }),
  elements: many(elements),
}));

export const materialRelations = relations(materials, ({ one, many }) => ({
  project: one(projects, {
    fields: [materials.projectId],
    references: [projects.id],
  }),
  lcaMaterial: one(lcaMaterials, {
    fields: [materials.lcaMaterialId],
    references: [lcaMaterials.id],
  }),
  elementMaterials: many(elementMaterials),
}));

export const elementRelations = relations(elements, ({ one, many }) => ({
  project: one(projects, {
    fields: [elements.projectId],
    references: [projects.id],
  }),
  upload: one(uploads, {
    fields: [elements.uploadId],
    references: [uploads.id],
  }),
  elementMaterials: many(elementMaterials),
}));

export const elementMaterialRelations = relations(
  elementMaterials,
  ({ one }) => ({
    element: one(elements, {
      fields: [elementMaterials.elementId],
      references: [elements.id],
    }),
    material: one(materials, {
      fields: [elementMaterials.materialId],
      references: [materials.id],
    }),
  })
);

export const lcaMaterialRelations = relations(lcaMaterials, ({ many }) => ({
  materials: many(materials),
}));
