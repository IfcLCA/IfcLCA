/**
 * MongoDB model for OpenEPD/EC3 materials cache
 * Global EPD database from Building Transparency
 */

import mongoose from "mongoose";

export interface IOpenEpdMaterial {
  // Primary identifier (OpenEPD uses various ID formats)
  id: string; // OpenEPD document ID or xpd_uuid

  // Display names
  name: string;
  productName?: string;
  manufacturerName?: string;

  // Category/classification
  category?: string;
  materialType?: string;

  // Physical properties
  density?: number; // kg/m³
  declaredUnit: string; // m³, kg, m², etc.
  declaredValue?: number; // e.g., 1 for "1 kg"

  // Environmental indicators (per declared unit)
  gwpDeclared: number; // GWP per declared unit
  gwpA1A2A3?: number; // Production stage GWP
  gwpC?: number; // End-of-life GWP

  // Normalized indicators (per kg)
  gwpTotal: number; // kg CO₂-eq/kg

  // Metadata
  version?: string;
  programOperator?: string;
  validUntil?: Date;
  lastUpdated: Date;
  epdUrl?: string;

  // Location/scope
  country?: string;
  region?: string;

  // Raw data for debugging
  rawData?: any;
}

interface OpenEpdMaterialModel extends mongoose.Model<IOpenEpdMaterial> {
  findValidMaterials(): mongoose.Query<IOpenEpdMaterial[], IOpenEpdMaterial>;
}

const openEpdSchema = new mongoose.Schema<
  IOpenEpdMaterial,
  OpenEpdMaterialModel
>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    productName: { type: String },
    manufacturerName: { type: String },
    category: { type: String },
    materialType: { type: String },
    density: { type: Number },
    declaredUnit: { type: String, required: true },
    declaredValue: { type: Number },
    gwpDeclared: { type: Number, required: true },
    gwpA1A2A3: { type: Number },
    gwpC: { type: Number },
    gwpTotal: { type: Number, required: true },
    version: { type: String },
    programOperator: { type: String },
    validUntil: { type: Date },
    lastUpdated: { type: Date, required: true, default: Date.now },
    epdUrl: { type: String },
    country: { type: String },
    region: { type: String },
    rawData: { type: mongoose.Schema.Types.Mixed },
  },
  {
    collection: "indicatorsOpenEpd",
    timestamps: true,
  }
);

// Indexes for performance
openEpdSchema.index({ id: 1 }, { unique: true });
openEpdSchema.index({ name: "text", productName: "text" });
openEpdSchema.index({ category: 1 });
openEpdSchema.index({ lastUpdated: 1 });
openEpdSchema.index({ gwpTotal: 1 });
openEpdSchema.index({ country: 1, region: 1 });

// Static method to find valid materials (has GWP)
openEpdSchema.static("findValidMaterials", function () {
  return this.find({
    gwpTotal: { $exists: true, $ne: null },
  }).sort({ name: 1 });
});

export const OpenEpdMaterial =
  (mongoose.models.OpenEpdMaterial as OpenEpdMaterialModel) ||
  mongoose.model<IOpenEpdMaterial, OpenEpdMaterialModel>(
    "OpenEpdMaterial",
    openEpdSchema,
    "indicatorsOpenEpd"
  );
