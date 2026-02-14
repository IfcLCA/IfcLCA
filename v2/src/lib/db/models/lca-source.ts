/**
 * LCA Source model — generic storage for all data source materials.
 *
 * Replaces v1's `indicatorsKBOB` collection. Every data source
 * (KBOB, Ökobaudat, INIES, etc.) stores normalized materials here
 * with a `source` discriminator field.
 */

import mongoose, { Schema, type Document } from "mongoose";
import type { IndicatorValues } from "@/types/lca";

export interface ILCASource extends Document {
  source: string;
  sourceId: string;
  name: string;
  nameOriginal?: string;
  category: string;
  categoryOriginal?: string;
  density: number | null;
  unit: string;
  indicators: IndicatorValues;
  metadata: {
    version: string;
    lastSynced: Date;
    validUntil?: Date;
    scope?: string;
    standard?: string;
  };
}

const LCASourceSchema = new Schema<ILCASource>(
  {
    source: { type: String, required: true, index: true },
    sourceId: { type: String, required: true },

    name: { type: String, required: true },
    nameOriginal: { type: String },
    category: { type: String, default: "Uncategorized" },
    categoryOriginal: { type: String },

    density: { type: Number, default: null },
    unit: { type: String, default: "kg" },

    indicators: {
      type: Schema.Types.Mixed,
      default: {},
    },

    metadata: {
      version: { type: String, default: "unknown" },
      lastSynced: { type: Date, default: Date.now },
      validUntil: { type: Date },
      scope: { type: String },
      standard: { type: String },
    },
  },
  {
    timestamps: true,
    collection: "lca_sources",
  }
);

// Unique compound index: one entry per source + sourceId
LCASourceSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// Text index for search
LCASourceSchema.index({ name: "text", nameOriginal: "text", category: "text" });

// Category browsing
LCASourceSchema.index({ source: 1, category: 1 });

// Sync queries
LCASourceSchema.index({ source: 1, "metadata.lastSynced": -1 });

export const LCASourceModel =
  mongoose.models.LCASource ||
  mongoose.model<ILCASource>("LCASource", LCASourceSchema);
