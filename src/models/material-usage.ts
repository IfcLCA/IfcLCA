import mongoose from "mongoose";

const materialUsageSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    volume: Number,
  },
  {
    timestamps: true,
  }
);

materialUsageSchema.index({ materialId: 1, projectId: 1 }, { unique: true });

const MaterialUsage =
  mongoose.models.MaterialUsage ||
  mongoose.model("MaterialUsage", materialUsageSchema);

export { MaterialUsage };
