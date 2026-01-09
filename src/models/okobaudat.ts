/**
 * MongoDB model for ÖKOBAUDAT materials cache
 * German national EPD database for construction products
 */

import mongoose from "mongoose";

export interface IOkobaudatMaterial {
  // Primary identifier
  uuid: string;

  // Display names
  name: string;
  nameDE?: string;
  nameEN?: string;

  // Category/classification
  category?: string;

  // Physical properties
  density: number; // kg/m³
  declaredUnit: string; // m³, kg, m², etc.

  // Environmental indicators (per declared unit, from API)
  gwpDeclared?: number | null; // GWP per declared unit
  penreDeclared?: number | null; // Primary energy non-renewable per declared unit

  // Normalized indicators (per kg, calculated)
  gwpTotal: number; // kg CO₂-eq/kg
  penreTotal?: number | null; // MJ/kg

  // Metadata
  version?: string;
  lastUpdated: Date;
  epdUrl?: string;
  validUntil?: Date;

  // Raw EPD data for debugging
  rawData?: any;
}

interface OkobaudatMaterialModel extends mongoose.Model<IOkobaudatMaterial> {
  findValidMaterials(): mongoose.Query<IOkobaudatMaterial[], IOkobaudatMaterial>;
}

const okobaudatSchema = new mongoose.Schema<
  IOkobaudatMaterial,
  OkobaudatMaterialModel
>(
  {
    uuid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameDE: { type: String },
    nameEN: { type: String },
    category: { type: String },
    density: { type: Number, required: true },
    declaredUnit: { type: String, required: true },
    gwpDeclared: { type: Number },
    penreDeclared: { type: Number },
    gwpTotal: { type: Number, required: true },
    penreTotal: { type: Number },
    version: { type: String },
    lastUpdated: { type: Date, required: true, default: Date.now },
    epdUrl: { type: String },
    validUntil: { type: Date },
    rawData: { type: mongoose.Schema.Types.Mixed },
  },
  {
    collection: "indicatorsOkobaudat",
    timestamps: true,
  }
);

// Indexes for performance
okobaudatSchema.index({ uuid: 1 }, { unique: true });
okobaudatSchema.index({ name: "text", nameDE: "text" });
okobaudatSchema.index({ category: 1 });
okobaudatSchema.index({ lastUpdated: 1 });
okobaudatSchema.index({ gwpTotal: 1, density: 1 });

// Static method to find valid materials (has GWP and density)
okobaudatSchema.static("findValidMaterials", function () {
  return this.find({
    gwpTotal: { $exists: true, $ne: null },
    density: { $exists: true, $ne: null, $gt: 0 },
  }).sort({ name: 1 });
});

export const OkobaudatMaterial =
  (mongoose.models.OkobaudatMaterial as OkobaudatMaterialModel) ||
  mongoose.model<IOkobaudatMaterial, OkobaudatMaterialModel>(
    "OkobaudatMaterial",
    okobaudatSchema,
    "indicatorsOkobaudat"
  );
