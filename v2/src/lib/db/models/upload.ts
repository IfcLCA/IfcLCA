/**
 * Upload model — tracks IFC file upload history.
 */

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IUpload extends Document {
  projectId: Types.ObjectId;
  userId: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  elementCount: number;
  materialCount: number;
}

const UploadSchema = new Schema<IUpload>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectV2",
      required: true,
    },
    userId: { type: String, required: true },
    filename: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    elementCount: { type: Number, default: 0 },
    materialCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "uploads_v2",
  }
);

UploadSchema.index({ projectId: 1, createdAt: -1 });

export const UploadModel =
  mongoose.models.UploadV2 ||
  mongoose.model<IUpload>("UploadV2", UploadSchema);
