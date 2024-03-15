const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { isAuthenticated } = require('./middleware/authMiddleware');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');

// Setup Multer for file upload
const upload = multer({ dest: 'uploads/' });

// POST endpoint for creating a new project
router.post('/api/projects', isAuthenticated, async (req, res) => {
  try {
    const { name, phase, description, customImage, totalCarbonFootprint } = req.body;
    const project = await Project.create({ name, phase, description, customImage, totalCarbonFootprint });
    console.log(`Project created successfully: ${project.name}`);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error.message);
    console.error(error.stack);
    res.status(400).json({ message: error.message, stack: error.stack });
  }
});

// GET endpoint for the new project creation form
router.get('/newProject', isAuthenticated, (req, res) => {
  try {
    res.render('newProject');
    console.log('Rendering new project form.');
  } catch (error) {
    console.error('Error rendering new project form:', error.message);
    console.error(error.stack);
    res.status(500).send('Error rendering new project form.');
  }
});

// GET endpoint for fetching all projects
router.get('/api/projects', isAuthenticated, async (req, res) => {
  try {
    const projects = await Project.find({});
    console.log(`Fetched ${projects.length} projects successfully.`);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    console.error(error.stack);
    res.status(500).json({ message: "Error fetching projects", error: error.message });
  }
});

// GET endpoint for a project's detailed page
router.get('/projects/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }
    res.render('projectHome', { project });
    console.log(`Rendering detailed page for project: ${project.name}`);
  } catch (error) {
    console.error('Error fetching project details:', error.message);
    console.error(error.stack);
    res.status(500).send('Error fetching project details.');
  }
});

// POST endpoint for IFC file upload
router.post('/api/projects/:projectId/upload', isAuthenticated, upload.single('ifcFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  
  const projectId = req.params.projectId;
  const filePath = req.file.path;

  // Determine Python command based on environment
  const pythonCommand = process.env.PYTHON_CMD || 'C:\\Users\\LouisTrümpler\\AppData\\Local\\Programs\\Python\\Python310\\python.exe';

  // Call the Python script to analyze the IFC file
  exec(`${pythonCommand} scripts/analyze_ifc.py "${filePath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      console.error(`Analysis script stderr: ${stderr}`);
      return res.status(500).send(`Error during file analysis: ${stderr}`);
    }

    const elementCount = parseInt(stdout, 10);
    if(isNaN(elementCount)) {
      console.error(`Error parsing element count from Python script: stdout=${stdout}`);
      return res.status(500).send('Error analyzing file: Invalid output from analysis script.');
    }

    try {
      // Update the project's totalCarbonFootprint in the database
      const project = await Project.findByIdAndUpdate(projectId, { $set: { totalCarbonFootprint: elementCount } }, { new: true });
      if (!project) {
        console.error(`Project with ID ${projectId} not found.`);
        return res.status(404).send('Project not found');
      }
      
      // Cleanup: Delete the temporary file
      fs.unlink(filePath, err => {
        if (err) {
          console.error(`Error removing temporary file: ${filePath}`, err);
          // Not returning to allow the process to continue despite the error
        }
        console.log(`Temporary file removed: ${filePath}`);
      });
      
      console.log(`Project ${project.name} updated successfully with new totalCarbonFootprint: ${elementCount}`);
      res.json(project);
    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).send('Error updating project with analysis results.');
    }
  });
});

// GET endpoint for editing a project's details
router.get('/projects/:projectId/edit', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }
    res.render('editProject', { project });
    console.log(`Rendering edit form for project: ${project.name}`);
  } catch (error) {
    console.error('Error rendering edit form:', error.message);
    console.error(error.stack);
    res.status(500).send('Error rendering edit form.');
  }
});

// POST endpoint for updating a project's details
router.post('/projects/:projectId/edit', isAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  const { name, phase, description, customImage, totalCarbonFootprint } = req.body;
  try {
    const updatedProject = await Project.findByIdAndUpdate(projectId, {
      name,
      phase,
      description,
      customImage,
      totalCarbonFootprint
    }, { new: true });
    if (!updatedProject) {
      return res.status(404).send('Project not found');
    }
    console.log(`Project ${updatedProject.name} updated successfully.`);
    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error('Error updating project:', error.message);
    console.error(error.stack);
    res.status(500).send('Error updating project');
  }
});

module.exports = router;