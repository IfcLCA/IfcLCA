import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    userId: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    calculationArea: {
      type: {
        type: String,
      },
      value: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        default: "m²",
      },
    },
    classificationSystem: {
      type: String,
      default: "eBKP-H",
    },
    emissions: {
      gwp: { type: Number, default: 0 },
      ubp: { type: Number, default: 0 },
      penre: { type: Number, default: 0 },
      lastCalculated: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Add indexes for better query performance
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ "emissions.lastCalculated": -1 });

export const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
