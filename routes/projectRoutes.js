const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { isAuthenticated } = require('./middleware/authMiddleware');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const { formatProjectNameForDisplay, appendTimestampToProjectName } = require('../utils/util');
const BuildingElement = require('../models/BuildingElement');

// Setup Multer for file upload
const upload = multer({ dest: 'uploads/' });

// POST endpoint for creating a new project
router.post('/api/projects', isAuthenticated, async (req, res) => {
  try {
    const { name, phase, description, customImage, totalCarbonFootprint, EBF } = req.body;
    const user = req.session.userId;
    const timestampedName = appendTimestampToProjectName(name);
    if (EBF < 0) {
      throw new Error("Invalid EBF value. EBF must be greater than 0.");
    }
    const project = await Project.create({ 
      name: timestampedName, 
      phase, 
      description, 
      customImage, 
      totalCarbonFootprint, 
      user,
      EBF 
    });
    console.log(`Project created successfully: ${project.name}`);
    // Modified to send JSON response instead of redirecting
    res.json({ status: 'success', url: `/projects/${project._id}` });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: "Error creating project", error: error.toString() });
  }
});

// GET endpoint for the new project creation form
router.get('/newProject', isAuthenticated, (req, res) => {
  try {
    res.render('newProject');
    console.log('Rendering new project form.');
  } catch (error) {
    console.error('Error rendering new project form:', error);
    res.status(500).send('Error rendering new project form.');
  }
});

// GET endpoint for fetching all projects
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId; 
    const projects = await Project.find({ user: userId });
    console.log(`Fetched ${projects.length} projects for user ID ${userId} successfully.`);
    projects.forEach(project => {
      if (project.EBF && project.totalCarbonFootprint) {
        project.co2PerSquareMeter = (project.totalCarbonFootprint / project.EBF).toFixed(2);
      }
    });
    res.render('dashboard', { projects, query: req.query, formatProjectNameForDisplay: formatProjectNameForDisplay });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: "Error fetching projects", error: error.toString() });
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
    if (project.EBF && project.totalCarbonFootprint) {
      project.co2PerSquareMeter = (project.totalCarbonFootprint / project.EBF).toFixed(2);
    }
    res.render('projectHome', { project, formatProjectNameForDisplay });
    console.log(`Rendering detailed page for project: ${project.name}`);
  } catch (error) {
    console.error('Error fetching project details:', error);
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
  const pythonCommand = process.env.PYTHON_CMD || 'C:\\Users\\LouisTrümpler\\anaconda3\\python.exe'; 

  // Call the Python script to analyze the IFC file
  exec(`${pythonCommand} scripts/analyze_ifc.py "${filePath}" "${projectId}"`, async (error, stdout, stderr) => {
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
        }
        console.log(`Temporary file removed: ${filePath}`);
      });
      
      console.log(`Project ${project.name} updated successfully with new totalCarbonFootprint: ${elementCount}`);
      res.redirect(`/projects/${projectId}`);
    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).send('Error updating project with analysis results.');
    }
  });
});
// POST endpoint for deleting a project
router.post('/api/projects/:projectId/delete', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    await Project.findByIdAndDelete(projectId); // Changed from findByIdAndRemove to findByIdAndDelete
    console.log(`Project with ID ${projectId} has been deleted successfully.`);
    res.redirect('/dashboard?deletionSuccess=true');
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).send('Error deleting project.');
  }
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
    console.error('Error rendering edit form:', error);
    res.status(500).send('Error rendering edit form.');
  }
});

// POST endpoint for updating a project's details
router.post('/projects/:projectId/edit', isAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  const { name, phase, description, customImage, totalCarbonFootprint, EBF } = req.body; // Include EBF in the data received from the request for update
  try {
    if (EBF < 0) {
      throw new Error("Invalid EBF value. EBF must be greater than 0.");
    }
    const updatedProject = await Project.findByIdAndUpdate(projectId, {
      name,
      phase,
      description,
      customImage,
      totalCarbonFootprint,
      EBF // Update the project with the new EBF value
    }, { new: true });
    if (!updatedProject) {
      return res.status(404).send('Project not found');
    }
    console.log(`Project ${updatedProject.name} updated successfully.`);
    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).send('Error updating project');
  }
});

// GET endpoint for fetching all elements of a project as JSON
router.get('/api/projects/:projectId/elements', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId).populate('building_elements');
    if (!project) {
      return res.status(404).send('Project not found');
    }
    console.log('Fetched project:', project);  // Log the fetched project data
    res.json(project.building_elements);  // Send the building_elements as a JSON response
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).send('Error fetching project');
  }
});
module.exports = router;// GET endpoint for fetching the latest elements of a project by name as JSON
router.get('/api/projects/latest/:projectName/elements', isAuthenticated, async (req, res) => {
  try {
    const projectName = req.params.projectName;
    // Find the latest project with the given name
    const project = await Project.findOne({ name: projectName }).sort({ createdAt: -1 }).populate('building_elements');
    if (!project) {
      return res.status(404).send('Project not found');
    }
    console.log('Fetched latest project elements:', project.building_elements);  // Log the fetched building elements
    res.json(project.building_elements);  // Send the building_elements as a JSON response
  } catch (error) {
    console.error('Error fetching project elements:', error);
    res.status(500).send('Error fetching project elements');
  }
});
