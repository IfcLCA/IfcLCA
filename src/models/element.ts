import mongoose from "mongoose";

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
    materials: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        volume: Number,
        fraction: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
elementSchema.index({ projectId: 1 });
elementSchema.index({ uploadId: 1 });
elementSchema.index({ guid: 1 });

export const Element =
  mongoose.models.Element || mongoose.model("Element", elementSchema);
