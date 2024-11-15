import mongoose from "mongoose";

// Define the schema type for KBOB reference
interface IMaterial {
  name: string;
  projectId: mongoose.Types.ObjectId;
  category?: string;
  volume: number;
  density?: number;
  kbobMatchId?: mongoose.Types.ObjectId;
  gwp?: number;
  ubp?: number;
  penre?: number;
  autoMatched?: boolean;
  matchScore?: number;
}

const materialSchema = new mongoose.Schema<IMaterial>(
  {
    name: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    category: String,
    volume: {
      type: Number,
      default: 0,
    },
    density: {
      type: Number,
    },
    kbobMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KBOBMaterial",
    },
    gwp: {
      type: Number,
      default: 0,
    },
    ubp: {
      type: Number,
      default: 0,
    },
    penre: {
      type: Number,
      default: 0,
    },
    autoMatched: {
      type: Boolean,
      default: false,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 1,
    },
  },
  {
    timestamps: true,
  }
);

materialSchema.index({ name: 1, projectId: 1 }, { unique: true });

materialSchema.post('save', async function(doc) {
  if (this.isModified('kbobMatchId')) {
    // Import here to avoid circular dependency
    const { MaterialService } = require('@/lib/services/material-service');
    await MaterialService.recalculateElementsForMaterials([doc._id]);
  }
});

materialSchema.post('updateMany', async function(result) {
  // For bulk updates, we need to get the updated documents
  const updatedMaterials = await this.model.find(this.getQuery()).select('_id');
  if (updatedMaterials.length > 0) {
    const { MaterialService } = require('@/lib/services/material-service');
    await MaterialService.recalculateElementsForMaterials(
      updatedMaterials.map(m => m._id)
    );
  }
});

// Ensure model is registered only once
const Material =
  (mongoose.models.Material as mongoose.Model<IMaterial>) ||
  mongoose.model<IMaterial>("Material", materialSchema);

export { Material };
