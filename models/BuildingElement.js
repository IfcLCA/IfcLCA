const mongoose = require('mongoose');

const buildingElementSchema = new mongoose.Schema({
  guid: { type: String, required: true },
  instance_name: { type: String, required: true },
  ifc_class: { type: String, required: true },
  materials_info: [{
    name: String,
    volume: Number
  }],
  total_volume: { type: Number, required: true },
  
  
  projectId: { type: String, required: true },
  

}, { timestamps: true });

const BuildingElement = mongoose.model('building-elements', buildingElementSchema);

module.exports = BuildingElement;
