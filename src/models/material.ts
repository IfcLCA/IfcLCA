import mongoose from "mongoose";

// Define the schema type for KBOB reference
interface IMaterial {
  name: string;
  projectId: mongoose.Types.ObjectId;
  category?: string;
  volume: number;
  density?: number;
  kbobMatchId?: mongoose.Types.ObjectId;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    name: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    category: String,
    volume: {
      type: Number,
      default: 0,
    },
    density: {
      type: Number,
    },
    kbobMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KBOBMaterial",
    },
  },
  {
    timestamps: true,
  }
);

materialSchema.index({ name: 1, projectId: 1 }, { unique: true });

// Ensure model is registered only once
const Material =
  (mongoose.models.Material as mongoose.Model<IMaterial>) ||
  mongoose.model<IMaterial>("Material", materialSchema);

export { Material };
