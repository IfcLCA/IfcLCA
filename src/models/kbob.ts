import mongoose from "mongoose";

interface IKBOBMaterial {
  // Database schema fields - kept for existing data compatibility
  KBOB_ID?: number;
  Name: string;
  Category?: string;
  GWP?: number;
  UBP?: number;
  PENRE?: number;
  "kg/unit"?: number | string;
  "min density"?: number;
  "max density"?: number;

  // New API fields (used by application)
  uuid?: string; // Primary identifier from API
  nameDE?: string; // German name from API
  nameFR?: string; // French name from API
  group?: string; // Group/category from API
  version?: string; // API version
  lastUpdated?: Date; // Cache timestamp

  // New environmental impact fields (used by application)
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;

  // Density from API (can be string or number)
  density?: number | string | null;
  unit?: string;
}

// Export interface for use in other files
export type IKBOBMaterialDocument = IKBOBMaterial & mongoose.Document & {
  _id: mongoose.Types.ObjectId;
};

interface KBOBMaterialModel extends mongoose.Model<IKBOBMaterial> {
  findValidMaterials(): mongoose.Query<IKBOBMaterialDocument[], IKBOBMaterialDocument>;
}

const kbobSchema = new mongoose.Schema<IKBOBMaterial, KBOBMaterialModel>(
  {
    // Old DB fields (may exist in DB but not used by application logic)
    KBOB_ID: { type: Number },
    Name: { type: String, required: true },
    Category: { type: String },
    GWP: { type: Number },
    UBP: { type: Number },
    PENRE: { type: Number },
    "kg/unit": mongoose.Schema.Types.Mixed,
    "min density": Number,
    "max density": Number,

    // New API fields (used by application)
    uuid: { type: String, unique: true, sparse: true },
    nameDE: { type: String },
    nameFR: { type: String },
    group: { type: String },
    version: { type: String },
    lastUpdated: { type: Date },

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
kbobSchema.index({ uuid: 1 }, { unique: true, sparse: true, name: "uniq_uuid" });
kbobSchema.index({ Name: 1 });
kbobSchema.index({ Category: 1 });
kbobSchema.index({ group: 1 });
kbobSchema.index({ lastUpdated: 1 });

// Add a static method to find valid materials
// Uses new API format
kbobSchema.static("findValidMaterials", function () {
  return this.find({
    $and: [
      // Must have environmental indicators in new API format with non-zero values
      // At least one indicator must be non-zero to be considered valid
      {
        $and: [
          { gwpTotal: { $exists: true, $ne: null } },
          { ubp21Total: { $exists: true, $ne: null } },
          { primaryEnergyNonRenewableTotal: { $exists: true, $ne: null } },
        ],
      },
      // At least one environmental indicator must be non-zero
      {
        $or: [
          { gwpTotal: { $ne: 0 } },
          { ubp21Total: { $ne: 0 } },
          { primaryEnergyNonRenewableTotal: { $ne: 0 } },
        ],
      },
      // Must have valid density
      {
        density: {
          $exists: true,
          $ne: null,
          $nin: [null, "-", "", 0],
        },
      },
    ],
  }).sort({ Name: 1 });
});

// Create or update the model
export const KBOBMaterial =
  (mongoose.models.KBOBMaterial as KBOBMaterialModel) ||
  mongoose.model<IKBOBMaterial, KBOBMaterialModel>("KBOBMaterial", kbobSchema, "indicatorsKBOB");
