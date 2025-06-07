import mongoose from "mongoose";

export type EnvironmentalMaterialSource = 'kbob' | 'oekobaudat' | 'custom';

export interface ILCAIndicators {
  gwp?: number;
  ubp?: number;
  penre?: number;
}

export interface IEnvironmentalMaterial {
  name: string;
  indicators: ILCAIndicators;
  density?: number;
  source: EnvironmentalMaterialSource;
}

const indicatorsSchema = new mongoose.Schema<ILCAIndicators>({
  gwp: { type: Number },
  ubp: { type: Number },
  penre: { type: Number },
});

const environmentalMaterialSchema = new mongoose.Schema<IEnvironmentalMaterial>(
  {
    name: { type: String, required: true, index: true },
    indicators: { type: indicatorsSchema, required: true },
    density: { type: Number },
    source: {
      type: String,
      required: true,
      enum: ['kbob', 'oekobaudat', 'custom'],
    },
  },
  {
    timestamps: true,
  }
);

export const EnvironmentalMaterial =
  mongoose.models.EnvironmentalMaterial ||
  mongoose.model<IEnvironmentalMaterial>(
    'EnvironmentalMaterial',
    environmentalMaterialSchema
  );
