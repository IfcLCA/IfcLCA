import mongoose from "mongoose";

export interface IOekobaudatMaterial {
  uuid: string;
  name: string;
  category?: string;
  subCategory?: string;
  gwp?: number;
  penrt?: number;
}

const oekobaudatSchema = new mongoose.Schema<IOekobaudatMaterial>(
  {
    uuid: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    category: { type: String },
    subCategory: { type: String },
    gwp: { type: Number },
    penrt: { type: Number },
  },
  {
    collection: "indicatorsOekobaudat",
    strict: false,
  }
);

oekobaudatSchema.index({ uuid: 1 });
oekobaudatSchema.index({ name: 1 });

export const OekobaudatMaterial =
  (mongoose.models.OekobaudatMaterial as mongoose.Model<IOekobaudatMaterial>) ||
  mongoose.model<IOekobaudatMaterial>("OekobaudatMaterial", oekobaudatSchema, "indicatorsOekobaudat");
