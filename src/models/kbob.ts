import mongoose from "mongoose";

interface IKBOBMaterial {
  // Legacy fields (for backward compatibility)
  KBOB_ID?: number;
  Name: string;
  Category?: string;
  GWP?: number; // Legacy field, kept for backward compatibility
  UBP?: number; // Legacy field, kept for backward compatibility
  PENRE?: number; // Legacy field, kept for backward compatibility
  "kg/unit"?: number | string;
  "min density"?: number;
  "max density"?: number;
  
  // New API fields
  uuid?: string; // Primary identifier from API
  nameDE?: string; // German name from API
  nameFR?: string; // French name from API
  group?: string; // Group/category from API
  version?: string; // API version
  lastUpdated?: Date; // Cache timestamp
  
  // New environmental impact fields (from API)
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
  
  // Density from API (can be string or number)
  density?: number | string | null;
  unit?: string;
}

interface KBOBMaterialModel extends mongoose.Model<IKBOBMaterial> {
  findValidMaterials(): Promise<IKBOBMaterial[]>;
}

const kbobSchema = new mongoose.Schema<IKBOBMaterial, KBOBMaterialModel>(
  {
    // Legacy fields
    KBOB_ID: { type: Number, index: true },
    Name: { type: String, required: true, index: true },
    Category: { type: String, index: true },
    GWP: { type: Number },
    UBP: { type: Number },
    PENRE: { type: Number },
    "kg/unit": mongoose.Schema.Types.Mixed,
    "min density": Number,
    "max density": Number,
    
    // New API fields
    uuid: { type: String, index: true, unique: true, sparse: true },
    nameDE: { type: String, index: true },
    nameFR: { type: String },
    group: { type: String, index: true },
    version: { type: String },
    lastUpdated: { type: Date, index: true },
    
    // New environmental impact fields
    gwpTotal: { type: Number },
    ubp21Total: { type: Number },
    primaryEnergyNonRenewableTotal: { type: Number },
    
    // Density from API
    density: mongoose.Schema.Types.Mixed,
    unit: { type: String },
  },
  {
    collection: "indicatorsKBOB",
    strict: false,
  }
);

// Add indexes for better query performance
// Note: KBOB_ID unique index removed as it's now optional for backward compatibility
kbobSchema.index({ uuid: 1 }, { unique: true, sparse: true, name: "uniq_uuid" });
kbobSchema.index({ Name: 1 });
kbobSchema.index({ Category: 1 });
kbobSchema.index({ group: 1 });
kbobSchema.index({ lastUpdated: 1 });

// Add a static method to find valid materials
// Supports both legacy and new API formats
kbobSchema.static("findValidMaterials", function () {
  return this.find({
    $and: [
      // Must have at least one set of environmental indicators (legacy or new)
      {
        $or: [
          // Legacy format: GWP, UBP, PENRE
          {
            $and: [
              { GWP: { $exists: true, $ne: null } },
              { UBP: { $exists: true, $ne: null } },
              { PENRE: { $exists: true, $ne: null } },
            ],
          },
          // New API format: gwpTotal, ubp21Total, primaryEnergyNonRenewableTotal
          {
            $and: [
              { gwpTotal: { $exists: true, $ne: null } },
              { ubp21Total: { $exists: true, $ne: null } },
              { primaryEnergyNonRenewableTotal: { $exists: true, $ne: null } },
            ],
          },
        ],
      },
      // Must have either valid kg/unit, density, or both min/max density
      {
        $or: [
          {
            "kg/unit": {
              $exists: true,
              $nin: [null, "-"],
              $type: "number",
            },
          },
          {
            density: {
              $exists: true,
              $ne: null,
              $nin: [null, "-", ""],
            },
          },
          {
            $and: [
              { "min density": { $exists: true, $ne: null, $type: "number" } },
              { "max density": { $exists: true, $ne: null, $type: "number" } },
            ],
          },
        ],
      },
    ],
  }).sort({ Name: 1 });
});

// Create or update the model
export const KBOBMaterial =
  (mongoose.models.KBOBMaterial as KBOBMaterialModel) ||
  mongoose.model<IKBOBMaterial, KBOBMaterialModel>("KBOBMaterial", kbobSchema, "indicatorsKBOB");
