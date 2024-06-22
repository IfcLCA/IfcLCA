const mongoose = require("mongoose");
const buildingElementSchema = new mongoose.Schema(
  {
    guid: String,
    instance_name: String,
    ifc_class: String,
    materials_info: [
      {
        materialId: mongoose.Schema.Types.ObjectId, // Original material ID from the IFC file
        name: String,
        volume: Number,
        matched_material_id: mongoose.Schema.Types.ObjectId, // ID of the matched material from database
        matched_material_name: String, // Name of the matched material
        density: Number, // Density from matched material
        indikator: Number, // CO2 indicator from matched material
        total_co2: Number, // Calculated total CO2
      },
    ],
    total_volume: Number,
    is_multilayer: Boolean,
    ifc_file_origin: String,
    user_id: String,
    session_id: String,
    projectId: String,
    building_storey: String,
    is_loadbearing: Boolean,
    is_external: Boolean,
    surface: Number,
  },
  { timestamps: true }
);

const BuildingElement = mongoose.model(
  "BuildingElement",
  buildingElementSchema,
  "building_elements"
);
module.exports = BuildingElement;
