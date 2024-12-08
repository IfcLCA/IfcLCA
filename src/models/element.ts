import mongoose from "mongoose";

interface IElement {
  projectId: mongoose.Types.ObjectId;
  guid: string;
  name: string;
  type: string;
  volume: number;
  loadBearing: boolean;
  isExternal: boolean;
  materials: Array<{
    material: mongoose.Types.ObjectId;
    volume: number;
    density: number;
    mass: number;
    fraction: number;
    indicators?: {
      gwp: number;
      ubp: number;
      penre: number;
    };
  }>;
  object_type: string;
}

const elementSchema = new mongoose.Schema<IElement>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    guid: String,
    name: String,
    type: String,
    object_type: String,
    volume: Number,
    loadBearing: { type: Boolean, default: false },
    isExternal: { type: Boolean, default: false },
    materials: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        volume: Number,
        density: Number,
        mass: Number,
        fraction: Number,
        indicators: {
          gwp: Number,
          ubp: Number,
          penre: Number,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
elementSchema.index({ projectId: 1, guid: 1 });
elementSchema.index({ "materials.material": 1 });
elementSchema.index({ uploadId: 1, projectId: 1 });

export const Element =
  (mongoose.models.Element as mongoose.Model<IElement>) ||
  mongoose.model<IElement>("Element", elementSchema);
