import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Processing", "Completed", "Failed"],
      default: "Processing",
    },
    elementCount: {
      type: Number,
      default: 0,
    },
    error: String,
  },
  {
    timestamps: true,
  }
);

export const Upload =
  mongoose.models.Upload || mongoose.model("Upload", uploadSchema);
