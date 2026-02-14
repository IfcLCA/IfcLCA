/**
 * Element model — IFC building element with material layers and indicators.
 */

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IElement extends Document {
  projectId: Types.ObjectId;
  uploadId: Types.ObjectId;
  guid: string;
  name: string;
  type: string;
  loadBearing: boolean;
  isExternal: boolean;
  classification?: {
    system: string;
    code: string;
    name: string;
  };
  materials: Array<{
    material: Types.ObjectId;
    volume: number;
    fraction: number;
    thickness?: number;
    indicators?: Record<string, number | null>;
  }>;
}

const ElementSchema = new Schema<IElement>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectV2",
      required: true,
    },
    uploadId: { type: Schema.Types.ObjectId, required: true },
    guid: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    loadBearing: { type: Boolean, default: false },
    isExternal: { type: Boolean, default: false },
    classification: {
      system: { type: String },
      code: { type: String },
      name: { type: String },
    },
    materials: [
      {
        material: { type: Schema.Types.ObjectId, ref: "MaterialV2" },
        volume: { type: Number, required: true },
        fraction: { type: Number, required: true },
        thickness: { type: Number },
        indicators: { type: Schema.Types.Mixed },
      },
    ],
  },
  {
    timestamps: true,
    collection: "elements_v2",
  }
);

// Unique element per project (by IFC GUID)
ElementSchema.index({ projectId: 1, guid: 1 }, { unique: true });

// Query elements by project + time
ElementSchema.index({ projectId: 1, createdAt: -1 });

// Find elements by material reference
ElementSchema.index({ "materials.material": 1 });

// Query by upload
ElementSchema.index({ uploadId: 1 });

export const ElementModel =
  mongoose.models.ElementV2 ||
  mongoose.model<IElement>("ElementV2", ElementSchema);
