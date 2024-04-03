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
  is_multilayer: { type: Boolean, required: true },
  ifc_file_origin: String,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session_id: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }
}, { timestamps: true });

const BuildingElement = mongoose.model('BuildingElement', buildingElementSchema);

module.exports = BuildingElement;
