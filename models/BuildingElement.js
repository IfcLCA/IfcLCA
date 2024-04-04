const mongoose = require('mongoose');

const buildingElementSchema = new mongoose.Schema({
  guid: String,
  instance_name: String,
  ifc_class: String,
  materials_info: [{
    name: String,
    volume: Number
  }],
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
  matched_material: String,
  rohdichte: Number,
  indikator: Number,
  total_co2: Number,
  bewehrung: Number,
}, { timestamps: false });

const BuildingElement = mongoose.model('BuildingElement', buildingElementSchema, 'building_elements');
module.exports = BuildingElement;