import mongoose from "mongoose";

interface IKBOBMaterial {
  KBOB_ID: number;
  Name: string;
  Category?: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "kg/unit"?: number | string;
  "min density"?: number;
  "max density"?: number;
}

interface KBOBMaterialModel extends mongoose.Model<IKBOBMaterial> {
  findValidMaterials(): Promise<IKBOBMaterial[]>;
}

const kbobSchema = new mongoose.Schema<IKBOBMaterial, KBOBMaterialModel>(
  {
    KBOB_ID: { type: Number, required: true, index: true },
    Name: { type: String, required: true },
    Category: { type: String },
    GWP: { type: Number, required: true },
    UBP: { type: Number, required: true },
    PENRE: { type: Number, required: true },
    "kg/unit": mongoose.Schema.Types.Mixed,
    "min density": Number,
    "max density": Number,
  },
  {
    collection: "indicatorsKBOB",
    strict: false,
  }
);

// Add index for faster lookups by material name
kbobSchema.index({ Name: 1 });

// Add a static method to find valid materials
kbobSchema.static("findValidMaterials", function () {
  return this.find({
    $and: [
      // Must have all required indicators
      { GWP: { $exists: true, $ne: null } },
      { UBP: { $exists: true, $ne: null } },
      { PENRE: { $exists: true, $ne: null } },
      // Must have either valid kg/unit or both min/max density
      {
        $or: [
          {
            "kg/unit": {
              $exists: true,
              $ne: null,
              $ne: "-",
              $type: "number",
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
