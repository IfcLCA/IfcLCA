import mongoose from "mongoose";

interface IMaterialLayer {
  material: mongoose.Types.ObjectId;
  volume: number;
  fraction: number;
  thickness?: number;
}

interface IElement {
  projectId: mongoose.Types.ObjectId;
  uploadId?: mongoose.Types.ObjectId;
  guid: string;
  name: string;
  type: string;
  volume?: number;
  buildingStorey?: string;
  loadBearing: boolean;
  isExternal: boolean;
  materials: IMaterialLayer[];
}

const materialLayerSchema = new mongoose.Schema<IMaterialLayer>({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material",
    required: true,
  },
  volume: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: "Volume must be a finite number",
    },
  },
  fraction: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  thickness: {
    type: Number,
    min: 0,
  },
});

const elementSchema = new mongoose.Schema<IElement>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
      index: true,
    },
    guid: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    volume: {
      type: Number,
      default: 0,
    },
    buildingStorey: {
      type: String,
    },
    loadBearing: {
      type: Boolean,
      default: false,
    },
    isExternal: {
      type: Boolean,
      default: false,
    },
    materials: [materialLayerSchema],
  },
  {
    timestamps: true,
  },
);

// Indexes
elementSchema.index({ projectId: 1, guid: 1 }, { unique: true });
elementSchema.index({ "materials.material": 1 });
elementSchema.index({ projectId: 1, uploadId: 1 });

// Virtual for total volume
elementSchema.virtual("totalVolume").get(function () {
  return this.materials.reduce((sum, mat) => sum + (mat.volume || 0), 0);
});

// Virtual for emissions (calculated on-the-fly)
elementSchema.virtual("emissions").get(function () {
  return this.materials.reduce(
    (acc, mat) => {
      const material = mat.material as any; // Will be populated
      if (!material?.kbobMatchId) return acc;

      const volume = mat.volume || 0;
      const density = material.density || 0;
      const mass = volume * density;

      return {
        gwp: acc.gwp + mass * (material.kbobMatchId.GWP || 0),
        ubp: acc.ubp + mass * (material.kbobMatchId.UBP || 0),
        penre: acc.penre + mass * (material.kbobMatchId.PENRE || 0),
      };
    },
    { gwp: 0, ubp: 0, penre: 0 },
  );
});

// Middleware to validate material fractions sum to 1
elementSchema.pre("save", function (next) {
  const totalFraction = this.materials.reduce(
    (sum, mat) => sum + mat.fraction,
    0,
  );
  if (Math.abs(totalFraction - 1) > 0.0001) {
    next(new Error("Material fractions must sum to 1"));
  }
  next();
});

export const Element =
  mongoose.models.Element || mongoose.model<IElement>("Element", elementSchema);
