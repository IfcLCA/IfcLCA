import mongoose from "mongoose";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";
import type { LcaDataSource } from "@/lib/types/lca";

/**
 * LCA Match subdocument - stores reference to matched LCA material
 * from any supported data source (KBOB, ÖKOBAUDAT, OpenEPD)
 */
interface ILcaMatch {
  /** Data source: kbob, okobaudat, openepd */
  source: LcaDataSource;
  /** Source-prefixed ID (e.g., "KBOB_uuid", "OKOBAU_uuid", "OPENEPD_id") */
  materialId: string;
  /** Original source UUID/ID */
  sourceId: string;
  /** Cached material name for display */
  name: string;
  /** When the match was created */
  matchedAt: Date;
  /** Cached indicator values at match time */
  indicators?: {
    gwp: number;
    ubp?: number | null;
    penre?: number | null;
  };
}

interface IMaterial {
  projectId: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  density?: number;
  volume?: number;
  /** @deprecated Use lcaMatch instead. Kept for backward compatibility. */
  kbobMatchId?: mongoose.Types.ObjectId;
  /** New multi-source LCA match reference */
  lcaMatch?: ILcaMatch;
  lastCalculated?: Date;
}

const lcaMatchSchema = new mongoose.Schema<ILcaMatch>(
  {
    source: {
      type: String,
      enum: ["kbob", "okobaudat", "openepd"],
      required: true,
    },
    materialId: {
      type: String,
      required: true,
    },
    sourceId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    matchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    indicators: {
      gwp: { type: Number },
      ubp: { type: Number },
      penre: { type: Number },
    },
  },
  { _id: false }
);

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
    // Legacy field - kept for backward compatibility
    kbobMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KBOBMaterial",
    },
    // New multi-source LCA match
    lcaMatch: {
      type: lcaMatchSchema,
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
materialSchema.index({ "lcaMatch.source": 1 });
materialSchema.index({ "lcaMatch.materialId": 1 });

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

// Virtual for emissions factors - supports both legacy kbobMatchId and new lcaMatch
materialSchema.virtual("emissionFactors").get(function () {
  // First check new lcaMatch with cached indicators
  if (this.lcaMatch?.indicators) {
    return {
      gwp: this.lcaMatch.indicators.gwp ?? 0,
      ubp: this.lcaMatch.indicators.ubp ?? 0,
      penre: this.lcaMatch.indicators.penre ?? 0,
    };
  }

  // Fall back to legacy KBOB match (requires population)
  if (!this.populated("kbobMatchId")) return null;

  const kbob = this.kbobMatchId as any;
  if (!kbob) return null;

  // Use centralized helper functions for consistent indicator resolution
  return {
    gwp: getGWP(kbob),
    ubp: getUBP(kbob),
    penre: getPENRE(kbob),
  };
});

// Virtual to check if material has an LCA match (from any source)
materialSchema.virtual("hasLcaMatch").get(function () {
  return Boolean(this.lcaMatch?.materialId || this.kbobMatchId);
});

// Virtual to get the LCA source type
materialSchema.virtual("lcaSource").get(function () {
  if (this.lcaMatch?.source) {
    return this.lcaMatch.source;
  }
  if (this.kbobMatchId) {
    return "kbob";
  }
  return null;
});

export const Material =
  mongoose.models.Material ||
  mongoose.model<IMaterial>("Material", materialSchema);

export type { IMaterial, ILcaMatch };
