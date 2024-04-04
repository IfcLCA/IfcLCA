const mongoose = require('mongoose');

const buildingElementSchema = new mongoose.Schema({
  guid: { type: String, required: true },
  instance_name: { type: String, required: false },
  ifc_class: { type: String, required: false },
  materials_info: [{
    name: String,
    volume: Number
  }],
  total_volume: { type: Number, required: false },
  
  
  projectId: { type: String, required: false },
  

}, { timestamps: false });

const BuildingElement = mongoose.model('BuildingElement', buildingElementSchema);
module.exports = BuildingElement;