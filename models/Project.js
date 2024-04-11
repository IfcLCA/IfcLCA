const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phase: String,
  description: String,
  customImage: String, // Assuming this is a URL to an image
  totalCarbonFootprint: Number,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  EBF: Number, // EBF is now optional,
  building_elements: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BuildingElement'
    }
  ]
});


projectSchema.pre('save', function(next) {
  console.log(`Saving project: ${this.name}`);
  next();
});

projectSchema.post('save', function(doc, next) {
  console.log(`Project ${doc.name} saved successfully`);
  next();
});

projectSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code !== 11000) {
    console.error(`MongoDB error: ${error.message}`);
    next(error); // Pass on MongoDB errors other than code 11000
  } else if (error) {
    console.error(`Error saving project: ${error.message}`, error.stack);
    next(error); // Pass on any other errors to the handler
  } else {
    next();
  }
});

projectSchema.methods.calculateTotalCarbonFootprint = async function() {
  try {
    // Load the building elements related to this project, including their materials
    const buildingElements = await BuildingElement.find({ projectId: this._id }).populate({
      path: 'materials_info.material', // Assuming materials_info is an array and has a material reference
      model: 'CarbonMaterial'
    });

    let totalFootprint = 0;
    buildingElements.forEach(element => {
      element.materials_info.forEach(materialInfo => {
        const density = parseFloat(materialInfo.material['Rohdichte/Flächenmasse']);
        const volume = parseFloat(materialInfo.volume);
        const co2Indicator = parseFloat(materialInfo.material['Treibhausgasemissionen, Total, (in kg CO2-eq)']);

        if (!isNaN(density) && !isNaN(volume) && !isNaN(co2Indicator)) {
          totalFootprint += volume * density * co2Indicator;
        }
      });
    });

    // Save the calculated footprint to the project
    this.totalCarbonFootprint = totalFootprint;
    await this.save();

    console.log(`Updated total carbon footprint for project ${this.name}: ${totalFootprint}`);
  } catch (error) {
    console.error('Failed to calculate total carbon footprint:', error);
  }
};


const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

