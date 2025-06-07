import mongoose from "mongoose";

interface IEcoMaterialRef {
  source: string;
  id: mongoose.Types.ObjectId;
}

interface IMaterial {
  projectId: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  density?: number;
  ecoMaterial?: IEcoMaterialRef;
  lastCalculated?: Date;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
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
    ecoMaterial: {
      source: { type: String },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "ecoMaterial.source",
      },
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
materialSchema.index({ "ecoMaterial.id": 1 });

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
  if (!this.populated("ecoMaterial.id")) return null;

  const kbob = this.ecoMaterial?.id as any;
  if (!kbob) return null;

  return {
    gwp: kbob.GWP || 0,
    ubp: kbob.UBP || 0,
    penre: kbob.PENRE || 0,
  };
});

export const Material =
  mongoose.models.Material ||
  mongoose.model<IMaterial>("Material", materialSchema);
