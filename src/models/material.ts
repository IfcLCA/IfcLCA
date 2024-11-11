import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

// Remove ALL indexes first
materialSchema.indexes().forEach((index) => {
  materialSchema.index(index[0], { unique: false });
});

// Add the correct compound index
materialSchema.index({ name: 1, projectId: 1 }, { unique: true });

const Material =
  mongoose.models.Material || mongoose.model("Material", materialSchema);

export { Material };
