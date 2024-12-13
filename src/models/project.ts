import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
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

// Add index for better query performance
projectSchema.index({ "emissions.lastCalculated": -1 });

export const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
