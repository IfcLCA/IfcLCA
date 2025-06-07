import mongoose from "mongoose";

interface IOekobaudatMaterial {
  Name: string;
  GWP: number;
  UBP: number;
  PENRE: number;
}

interface OekobaudatMaterialModel
  extends mongoose.Model<IOekobaudatMaterial> {}

const oekobaudatSchema = new mongoose.Schema<
  IOekobaudatMaterial,
  OekobaudatMaterialModel
>(
  {
    Name: { type: String, required: true, index: true },
    GWP: { type: Number, required: true },
    UBP: { type: Number, required: true },
    PENRE: { type: Number, required: true },
  },
  {
    collection: "indicatorsOekobaudat",
    strict: false,
  }
);

oekobaudatSchema.index({ Name: 1 });

oekobaudatSchema.static("findValidMaterials", function () {
  return this.find({
    GWP: { $exists: true, $ne: null },
    UBP: { $exists: true, $ne: null },
    PENRE: { $exists: true, $ne: null },
  }).sort({ Name: 1 });
});

export const OekobaudatMaterial =
  (mongoose.models.OekobaudatMaterial as OekobaudatMaterialModel) ||
  mongoose.model<IOekobaudatMaterial, OekobaudatMaterialModel>(
    "OekobaudatMaterial",
    oekobaudatSchema,
    "indicatorsOekobaudat"
  );
