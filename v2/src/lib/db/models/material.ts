/**
 * Material model — project-level material with LCA match.
 *
 * Replaces v1's `materials` collection. Instead of `kbobMatchId`,
 * materials now have a generic `lcaMatch` object that can reference
 * any data source.
 */

import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { MatchMethod } from "@/types/lca";

export interface IMaterial extends Document {
  projectId: Types.ObjectId;
  name: string;
  category?: string;
  density?: number;
  totalVolume: number;
  lcaMatch?: {
    lcaMaterialId: Types.ObjectId;
    sourceId: string;
    source: string;
    score: number;
    method: MatchMethod;
    matchedAt: Date;
  };
}

const MaterialSchema = new Schema<IMaterial>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectV2",
      required: true,
    },
    name: { type: String, required: true },
    category: { type: String },
    density: { type: Number },
    totalVolume: { type: Number, default: 0 },
    lcaMatch: {
      lcaMaterialId: { type: Schema.Types.ObjectId, ref: "LCASource" },
      sourceId: { type: String },
      source: { type: String },
      score: { type: Number },
      method: { type: String },
      matchedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "materials_v2",
  }
);

// Unique material name per project
MaterialSchema.index({ projectId: 1, name: 1 }, { unique: true });

// Find materials by match status
MaterialSchema.index({ projectId: 1, "lcaMatch.source": 1 });

// Find materials matched to a specific LCA source material
MaterialSchema.index({ "lcaMatch.lcaMaterialId": 1 });

export const MaterialModel =
  mongoose.models.MaterialV2 ||
  mongoose.model<IMaterial>("MaterialV2", MaterialSchema);
