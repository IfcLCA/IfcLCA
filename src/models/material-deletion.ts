import mongoose from "mongoose";

const materialDeletionSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
    },
    materialName: {
      type: String,
      required: [true, "Material name is required"],
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: "material_deletions",
  }
);

// Add validation middleware
materialDeletionSchema.pre("save", function (next) {
  if (!this.projectId || !this.userId) {
    next(new Error("ProjectId and UserId are required"));
    return;
  }
  next();
});

export const MaterialDeletion =
  mongoose.models.MaterialDeletion ||
  mongoose.model("MaterialDeletion", materialDeletionSchema);
