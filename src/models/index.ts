import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    phase: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add virtual fields for counts
projectSchema.virtual("_count", {
  get() {
    return {
      uploads: 0, // Will be populated by API
      elements: 0, // Will be populated by API
      materials: 0, // Will be populated by API
    };
  },
});

const uploadSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  status: String,
  error: String,
  elementCount: { type: Number, default: 0 },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const elementSchema = new mongoose.Schema({
  guid: { type: String, unique: true },
  name: { type: String, required: true },
  type: String,
  volume: Number,
  buildingStorey: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload" },
  materials: [{ type: mongoose.Schema.Types.ObjectId, ref: "Material" }],
});

const materialSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  category: String,
  volume: Number,
  fraction: Number,
});

// Export models with type checking
export const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
export const Upload =
  mongoose.models.Upload || mongoose.model("Upload", uploadSchema);
export const Element =
  mongoose.models.Element || mongoose.model("Element", elementSchema);
export const Material =
  mongoose.models.Material || mongoose.model("Material", materialSchema);
