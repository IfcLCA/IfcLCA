import mongoose from "mongoose";

interface IMaterial {
  projectId: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  density?: number;
  
  // Data source tracking
  dataSource?: 'kbob' | 'okobaudat';
  
  // KBOB match (existing)
  kbobMatchId?: mongoose.Types.ObjectId;
  
  // Ökobaudat match (new)
  okobaudatMatchId?: string;  // UUID from Ökobaudat
  okobaudatData?: {
    uuid: string;
    name: string;
    category: string;
    declaredUnit: string;
    referenceFlowAmount: number;
    lastFetched: Date;
  };
  
  // Cached environmental indicators (for both sources)
  cachedIndicators?: {
    gwp: number;
    ubp?: number;  // Only for KBOB
    penre: number;
    source: 'kbob' | 'okobaudat';
    lastUpdated: Date;
  };
  
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
    
    // Data source tracking
    dataSource: {
      type: String,
      enum: ['kbob', 'okobaudat'],
      default: 'kbob',
    },
    
    // KBOB match (existing)
    kbobMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KBOBMaterial",
    },
    
    // Ökobaudat match (new)
    okobaudatMatchId: {
      type: String,
    },
    okobaudatData: {
      uuid: String,
      name: String,
      category: String,
      declaredUnit: String,
      referenceFlowAmount: Number,
      lastFetched: Date,
    },
    
    // Cached environmental indicators
    cachedIndicators: {
      gwp: Number,
      ubp: Number,
      penre: Number,
      source: {
        type: String,
        enum: ['kbob', 'okobaudat'],
      },
      lastUpdated: Date,
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
materialSchema.index({ kbobMatchId: 1 });
materialSchema.index({ okobaudatMatchId: 1 });
materialSchema.index({ dataSource: 1 });

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

// Virtual for emissions factors from matched database
materialSchema.virtual("emissionFactors").get(function () {
  // If we have cached indicators, use those (works for both KBOB and Ökobaudat)
  if (this.cachedIndicators) {
    return {
      gwp: this.cachedIndicators.gwp || 0,
      ubp: this.cachedIndicators.ubp || 0,
      penre: this.cachedIndicators.penre || 0,
      source: this.cachedIndicators.source,
    };
  }
  
  // Fallback to KBOB match for backward compatibility
  if (this.populated("kbobMatchId")) {
    const kbob = this.kbobMatchId as any;
    if (kbob) {
      return {
        gwp: kbob.GWP || 0,
        ubp: kbob.UBP || 0,
        penre: kbob.PENRE || 0,
        source: 'kbob',
      };
    }
  }
  
  return null;
});

export const Material =
  mongoose.models.Material ||
  mongoose.model<IMaterial>("Material", materialSchema);
