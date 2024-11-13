import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema({
  filename: String,
  status: String,
  elementCount: Number,
  materialCount: Number,
  error: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Upload =
  mongoose.models.Upload || mongoose.model("Upload", uploadSchema);
