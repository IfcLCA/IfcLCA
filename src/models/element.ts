import mongoose from "mongoose";

const elementMaterialSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },
    volume: Number,
    fraction: Number,
  },
  { _id: false }
);

const elementSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
      required: true,
    },
    guid: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: String,
    volume: Number,
    buildingStorey: String,
    materials: [elementMaterialSchema],
  },
  {
    timestamps: true,
  }
);

// Single compound index definition - no need to remove existing indexes first
elementSchema.index({ guid: 1, projectId: 1 }, { unique: true });

const Element =
  mongoose.models.Element || mongoose.model("Element", elementSchema);

export { Element };
