const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  phase: String,
  description: String,
  customImage: String, // Assuming this is a URL to an image
  totalCarbonFootprint: Number
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
  if (error.name === 'MongoError' && error.code === 11000) {
    console.error(`Error: A project with the name '${doc.name}' already exists.`);
    next(new Error('Duplicate project name.'));
  } else {
    console.error(`Error saving project: ${error.message}`, error.stack);
    next(error); // Pass on any other errors to the handler
  }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;