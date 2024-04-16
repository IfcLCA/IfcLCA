const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Project = require('../models/Project');
const { isAuthenticated } = require('./middleware/authMiddleware');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const Fuse = require('fuse.js');
const { formatProjectNameForDisplay, appendTimestampToProjectName } = require('../utils/util');
const BuildingElement = require('../models/BuildingElement');
const CarbonMaterial = require('../models/CarbonMaterial');


// Utility function to parse "Rohdichte/Flächenmasse" and handle non-numeric values
function parseDensity(density, materialName) {
  // Ensure density is defined before checking its content
  if (!density || density.includes("-")) {
    console.log(`Density value is invalid or undefined for material '${materialName}'. Returning 0.`);
    return 0;
  }

  const parsed = parseFloat(density);
  if (isNaN(parsed)) {
    console.log(`Unable to parse density '${density}' for material '${materialName}', setting to 0`);
    return 0;
  }

  return parsed;
}


// Utility function to parse "Treibhausgasemissionen, Total, (in kg CO2-eq)" and handle non-numeric values
function parseTreibhausgasemissionen(value, materialName) {
  if (value === undefined) {
    console.log(`Treibhausgasemissionen is undefined for material '${materialName}', setting to 0`);
    return 0;
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.log(`Unable to parse Treibhausgasemissionen '${value}' for material '${materialName}', setting to 0`);
    return 0;
  }

  return parsed;
}

// Priority materials map where keys are keywords to search in material names
const priorityMaterials = {
  "beton": "Hochbaubeton (ohne Bewehrung)",
  "Holzwerkstoffplatte": "3- und 5-Schicht Massivholzplatte",
  "Holz": "Brettschichtholz",
  "CLT": "Brettsperrholz",
  "Stahl": "Stahlprofil, blank",
  "S235": "Stahlprofil, blank",
  "S355": "Stahlprofil, blank",
  "S335": "Stahlprofil, blank",
  "S335J0": "Stahlprofil, blank",
  "Beton_vorfabriziert": "Betonfertigteil, hochfester Beton, ab Werk",
};

// Adjusted Fuse.js settings for matching
const fuseOptions = {
  keys: ['BAUMATERIALIEN'],
  threshold: 0.7, // Adjust for precision in matching priority materials
  includeScore: true,
  shouldSort: true,
};

// Convert priority materials to an array for Fuse.js search
const priorityMaterialsList = Object.values(priorityMaterials).map(material => ({ BAUMATERIALIEN: material }));

// Initialize Fuse with priority materials for searching the best match
const priorityFuse = new Fuse(priorityMaterialsList, fuseOptions);

// Initialize Fuse with all carbon materials for general search
let allMaterialsFuse; // This will be initialized after fetching carbonMaterials

// Function to find the best matching priority material using Fuse.js
function findBestPriorityMaterial(materialName) {
  const matches = priorityFuse.search(materialName);
  return matches.length > 0 ? matches[0].item.BAUMATERIALIEN : null;
}

// Function to find the best match for a material using Fuse.js and update the database
async function findBestMatchForMaterial(material, carbonMaterials, allMaterialsFuse) {
  const materialNameLower = material.name.toLowerCase();
  const priorityMaterialName = findBestPriorityMaterial(materialNameLower);
  let matchedMaterial = null;

  if (priorityMaterialName) {
    matchedMaterial = carbonMaterials.find(mat => mat.BAUMATERIALIEN === priorityMaterialName);
  } else {
    const matches = allMaterialsFuse.search(materialNameLower);
    if (matches.length > 0 && matches[0].score < 0.7) {
      matchedMaterial = matches[0].item;
    }
  }

  if (matchedMaterial) {
    const density = parseDensity(matchedMaterial['Rohdichte/Flächenmasse'], matchedMaterial.BAUMATERIALIEN);

    // Update the BuildingElement document with the matched material information for this specific material
    await BuildingElement.updateOne(
      { "_id": material.buildingElementId, "materials_info.materialId": material.materialId },
      { "$set": { 
        "materials_info.$.matched_material_id": matchedMaterial._id,
        "materials_info.$.matched_material_name": matchedMaterial.BAUMATERIALIEN,
        "materials_info.$.density": density, // Store the density
        "materials_info.$.indikator": parseTreibhausgasemissionen(matchedMaterial['Treibhausgasemissionen, Total,  (in kg CO2-eq)'], matchedMaterial.BAUMATERIALIEN),
      }}
    );
  } else {
    // If no match found, explicitly set "No Match"
    await BuildingElement.updateOne(
      { "_id": material.buildingElementId, "materials_info.materialId": material.materialId },
      { "$set": { 
        "materials_info.$.matched_material_name": "No Match"
      }}
    );
  }
  
  return matchedMaterial;
}


// Endpoint to fetch building elements and calculate carbon footprint
router.get('/api/projects/:projectId/building_elements', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const buildingElements = await BuildingElement.find({ projectId }).populate('materials_info.matched_material_id').lean();
    const carbonMaterials = await CarbonMaterial.find({}).lean();
    const allMaterialsFuse = new Fuse(carbonMaterials, fuseOptions); // Initialize Fuse with all materials

    let totalFootprint = 0;
    const responseData = await Promise.all(buildingElements.map(async element => {
      const materialsInfo = await Promise.all(element.materials_info.map(async material => {
        // Pass additional buildingElementId to match function
        material.buildingElementId = element._id;  // Ensure this ID is passed for correct querying
        const bestMatch = await findBestMatchForMaterial(material, carbonMaterials, allMaterialsFuse);
        if (!bestMatch) {
          console.log(`No match found for material '${material.name}'. Using default values.`);
          return {
            ...material,
            matched_material: "No Match",
            density: 0,
            indikator: 0,
            total_co2: 0
          };
        }
    
        const density = parseDensity(bestMatch['Rohdichte/Flächenmasse'], bestMatch.BAUMATERIALIEN);
        const indikator = parseTreibhausgasemissionen(bestMatch['Treibhausgasemissionen, Total,  (in kg CO2-eq)'], bestMatch.BAUMATERIALIEN);
        const totalCO2eq = material.volume * density * indikator;
        return {
          ...material,
          matched_material: bestMatch.BAUMATERIALIEN,
          density,
          indikator,
          total_co2: totalCO2eq.toFixed(3)
        };
      }));
    
      return { ...element, materials_info: materialsInfo };
    }));

    // Calculate the total carbon footprint for the project
    totalFootprint = responseData.reduce((total, element) => {
      return total + element.materials_info.reduce((elementTotal, material) => {
        return elementTotal + parseFloat(material.total_co2);
      }, 0);
    }, 0);
    
    // Optionally update the project's total carbon footprint
    await Project.findByIdAndUpdate(projectId, { $set: { totalCarbonFootprint: totalFootprint } });

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching building elements:', error);
    res.status(500).json({ message: "Error fetching building elements", error: error.toString() });
  }
});



// Endpoint to get material names for the dropdown
router.get('/api/materials/names', async (req, res) => {
  try {
      const carbonMaterials = await CarbonMaterial.find({}).lean(); // Fetch all materials
      allMaterialsFuse = new Fuse(carbonMaterials, { keys: ['BAUMATERIALIEN'], threshold: 0.7 }); // Initialize Fuse

      let results = carbonMaterials.map(material => material.BAUMATERIALIEN);
      if (req.query.search) {
          results = allMaterialsFuse.search(req.query.search).map(result => result.item.BAUMATERIALIEN);
      }
      
      res.json(results);
  } catch (error) {
      console.error('Failed to fetch material names:', error);
      res.status(500).send('Error fetching material names');
  }
});

// Endpoint to get detailed properties of a material by name
router.get('/api/materials/details/:name', isAuthenticated, async (req, res) => {
  try {
      const materialName = req.params.name;
      const material = await CarbonMaterial.findOne({ BAUMATERIALIEN: materialName }).lean();

      if (!material) {
          return res.status(404).json({ message: "Material not found" });
      }

      // Assuming the database schema has these fields, adjust as necessary.
      const density = parseDensity(material['Rohdichte/Flächenmasse'], materialName);
      const indicator = parseTreibhausgasemissionen(material['Treibhausgasemissionen, Total,  (in kg CO2-eq)'], materialName);

      res.json({
          density: density,
          indicator: indicator
      });
  } catch (error) {
      console.error('Failed to fetch material details:', error);
      res.status(500).send('Internal Server Error');
  }
});


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
    res.json({ status: 'success', url: `/projects/${project._id}` });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: "Error creating project", error: error.toString() });
  }
});

router.get('/api/projects/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId).populate('building_elements');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: "Error fetching project", error: error.toString() });
  }
});

// GET endpoint for the new project creation form
router.get('/newProject', isAuthenticated, (req, res) => {
  try {
    // Render the 'newProject.ejs' view instead of 'projectHome'
    res.render('newProject', { currentPage: 'newProject' });
    console.log('Rendering create new project form.');
  } catch (error) {
    console.error('Error rendering create new project form:', error);
    res.status(500).send('Error rendering create new project form.');
  }
});

// Route for the Open Source page
router.get('/opensource', (req, res) => {
  try {
    res.render('opensource', { title: 'Open Source Community' });
  } catch (error) {
    console.error('Error rendering Open Source page:', error);
    res.status(500).send('An error occurred while rendering the Open Source page.');
  }
});

// Route for the Open Source page
router.get('/contributing', (req, res) => {
  try {
    res.render('contributing', { title: 'Help is welcome' });
  } catch (error) {
    console.error('Error rendering Open Source page:', error);
    res.status(500).send('An error occurred while rendering the Open Source page.');
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
    res.render('dashboard', { projects, query: req.query, page: 'dashboard', formatProjectNameForDisplay: formatProjectNameForDisplay });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: "Error fetching projects", error: error.toString() });
  }
});


// GET endpoint for a project's detailed page
router.get('/projects/:projectId', isAuthenticated, async (req, res) => {
  try {
      const projectId = req.params.projectId;
      const project = await Project.findById(projectId).populate('building_elements');
      if (!project) {
          return res.status(404).send('Project not found');
      }
      if (project.EBF && project.totalCarbonFootprint) {
          project.co2PerSquareMeter = (project.totalCarbonFootprint / project.EBF).toFixed(2);
      }
      const buildingElements = await BuildingElement.find({ projectId: project._id });
      let materialsInfo = [];
      buildingElements.forEach(element => {
          materialsInfo = materialsInfo.concat(element.materials_info.map(material => ({
              ...material,
              instance_name: element.instance_name,
              ifc_class: element.ifc_class
          })));
      });

      // Define the function to format the project name
      function formatProjectNameForDisplay(name) {
          return name.replace(/_/g, ' ');
      }

      res.render('projectHome', {
          page: 'projectHome',
          project,
          materialsInfo,
          formatProjectNameForDisplay 
      });
  } catch (error) {
      console.error('Error fetching project details:', error);
      console.error(`Project ID: ${req.params.projectId}`);
      res.status(500).send('Error fetching project details.');
  }
});

// POST endpoint for IFC file upload
router.post('/api/projects/:projectId/upload', isAuthenticated, upload.single('ifcFile'), async (req, res) => {
  if (!req.file) {
      return res.status(400).send('No file uploaded.');
  }

  const projectId = req.params.projectId;
  const filePath = req.file.path;

  try {
      // Delete existing building elements for the project
      await BuildingElement.deleteMany({ projectId: projectId });

  // Process the new IFC file
  const pythonCommand = process.env.PYTHON_CMD || 'python'; // Adjust according to your server configuration
  exec(`${pythonCommand} scripts/analyze_ifc.py "${filePath}" "${projectId}"`, async (error, stdout, stderr) => {
      if (error) {
          console.error(`exec error: ${error}`);
          console.error(`Analysis script stderr: ${stderr}`);
          return res.status(500).send(`Error during file analysis: ${stderr}`);
      }

      // Assuming stdout outputs total CO2 calculated, or perform additional steps to calculate it
      const totalCO2 = parseFloat(stdout);
      if (isNaN(totalCO2)) {
          return res.status(500).send('Error parsing total CO2 from IFC file analysis output.');
      }

      const project = await Project.findById(projectId);
      if (!project) {
          return res.status(404).send('Project not found');
      }

      // Call the method to calculate total carbon footprint
      await project.calculateTotalCarbonFootprint();

      // Fetch the updated project data
      const updatedProject = await Project.findById(projectId);

      // Cleanup: Delete the temporary file
      fs.unlink(filePath, err => {
          if (err) {
              console.error(`Error removing temporary file: ${filePath}`, err);
          }
          console.log(`Temporary file removed: ${filePath}`);
      });

      console.log(`IFC file processed and project updated successfully: ${projectId}`);
      res.redirect(`/projects/${updatedProject._id}`); // Redirect or respond according to your frontend setup
  });
  } catch (error) {
      console.error('Error handling IFC upload:', error);
      res.status(500).send('Internal Server Error during IFC upload.');
  }
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

module.exports = router;