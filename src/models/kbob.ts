import mongoose from "mongoose";

interface IKBOBMaterial {
  KBOB_ID: number;
  Name: string;
  GWP: number;
  UBP: number;
  PENRE: number;
}

const kbobSchema = new mongoose.Schema<IKBOBMaterial>(
  {
    KBOB_ID: Number,
    Name: String,
    GWP: Number,
    UBP: Number,
    PENRE: Number,
  },
  {
    collection: "indicatorsKBOB",
    strict: false, // Allow additional fields from MongoDB
  }
);

// Ensure model is registered only once
const KBOBMaterial =
  (mongoose.models.KBOBMaterial as mongoose.Model<IKBOBMaterial>) ||
  mongoose.model<IKBOBMaterial>("KBOBMaterial", kbobSchema);

export { KBOBMaterial };
