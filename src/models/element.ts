import mongoose from "mongoose";

interface IElement {
  projectId: mongoose.Types.ObjectId;
  guid: string;
  name: string;
  type: string;
  volume: number;
  materials: Array<{
    material: mongoose.Types.ObjectId;
    volume: number;
    fraction: number;
    indicators?: {
      gwp: number;
      ubp: number;
      penre: number;
    };
  }>;
  // ... other fields
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
    volume: Number,
    materials: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
        volume: Number,
        fraction: Number,
        indicators: {
          gwp: Number,
          ubp: Number,
          penre: Number,
        },
      },
    ],
    // ... other fields
  },
  {
    timestamps: true,
  }
);

export const Element =
  (mongoose.models.Element as mongoose.Model<IElement>) ||
  mongoose.model<IElement>("Element", elementSchema);
