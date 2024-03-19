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
  building_elements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'building_elements'
  }],
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

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;