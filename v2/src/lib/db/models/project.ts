/**
 * Project model — user's LCA analysis project.
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface IProject extends Document {
  userId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  classificationSystem: string;
  preferredDataSource: string;
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };
  emissions?: {
    totals: Record<string, number | null>;
    lastCalculated: Date;
  };
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    classificationSystem: { type: String, default: "eBKP-H" },
    preferredDataSource: { type: String, default: "kbob" },
    calculationArea: {
      type: {
        type: String,
        value: Number,
        unit: String,
      },
      default: undefined,
    },
    emissions: {
      totals: { type: Schema.Types.Mixed },
      lastCalculated: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "projects_v2",
  }
);

ProjectSchema.index({ userId: 1, createdAt: -1 });

export const ProjectModel =
  mongoose.models.ProjectV2 ||
  mongoose.model<IProject>("ProjectV2", ProjectSchema);
