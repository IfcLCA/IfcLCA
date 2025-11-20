import mongoose from "mongoose";

interface IMaterial {
  projectId: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  density?: number;
  volume?: number;
  kbobMatchId?: mongoose.Types.ObjectId;
  lastCalculated?: Date;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
    },
    density: {
      type: Number,
      min: 0,
      validate: {
        validator: (v: number) => v === 0 || Number.isFinite(v),
        message: "Density must be 0 or a finite number",
      },
    },
    volume: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Volume must be a finite number",
      },
    },
    kbobMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KBOBMaterial",
    },
    lastCalculated: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
materialSchema.index({ projectId: 1, name: 1 }, { unique: true });
materialSchema.index({ projectId: 1, createdAt: -1 });
materialSchema.index({ kbobMatchId: 1 });

// Virtual for elements using this material
materialSchema.virtual("elements", {
  ref: "Element",
  localField: "_id",
  foreignField: "materials.material",
});

// Virtual for total volume across all elements
materialSchema.virtual("totalVolume").get(async function () {
  const result = await mongoose.model("Element").aggregate([
    {
      $match: {
        "materials.material": this._id,
      },
    },
    {
      $unwind: "$materials",
    },
    {
      $match: {
        "materials.material": this._id,
      },
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: "$materials.volume" },
      },
    },
  ]);

  return result[0]?.totalVolume || 0;
});

// Virtual for emissions factors from KBOB match
materialSchema.virtual("emissionFactors").get(function () {
  if (!this.populated("kbobMatchId")) return null;

  const kbob = this.kbobMatchId as any;
  if (!kbob) return null;

  // Use fallback logic directly (avoid require in virtual)
  const gwp = kbob.gwpTotal ?? kbob.GWP ?? 0;
  const ubp = kbob.ubp21Total ?? kbob.UBP ?? 0;
  const penre = kbob.primaryEnergyNonRenewableTotal ?? kbob.PENRE ?? 0;
  
  return {
    gwp,
    ubp,
    penre,
  };
});

export const Material =
  mongoose.models.Material ||
  mongoose.model<IMaterial>("Material", materialSchema);
