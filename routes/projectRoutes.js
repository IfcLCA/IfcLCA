const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Project = require('../models/Project');
const { isAuthenticated } = require('./middleware/authMiddleware');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const Fuse = require('fuse.js');
const BuildingElement = require('../models/BuildingElement');
const CarbonMaterial = require('../models/CarbonMaterial');
const { appendTimestampToProjectName, formatProjectNameForDisplay } = require('../utils/util');
const { isNaN } = require('lodash'); // Import lodash's isNaN for robust NaN checks

// Helper function to safely remove the file
async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to remove file at ${filePath}: ${error.message}`);
  }
}


// Route for the /opensource page
router.get('/opensource', (req, res) => {
  res.render('opensource');
});

module.exports = router;

function parseDensity(density, materialName) {
  if (!density || density.includes("-")) {
    console.log(`Density value is invalid or undefined for material '${materialName}'. Returning 0.`);
    return 0;
  }
  const parsed = parseFloat(density);
  return isNaN(parsed) ? 0 : parsed;
}

function parseTreibhausgasemissionen(value, materialName) {
  if (value === undefined) {
    console.log(`Treibhausgasemissionen is undefined for material '${materialName}', setting to 0`);
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}


// Priority materials map and Fuse.js settings
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

const fuseOptions = {
  keys: ['BAUMATERIALIEN'],
  threshold: 0.7,
  includeScore: true,
  shouldSort: true,
};

const priorityMaterialsList = Object.values(priorityMaterials).map(material => ({ BAUMATERIALIEN: material }));
const priorityFuse = new Fuse(priorityMaterialsList, fuseOptions);
let allMaterialsFuse;

function findBestPriorityMaterial(materialName) {
  const matches = priorityFuse.search(materialName);
  return matches.length > 0 ? matches[0].item.BAUMATERIALIEN : null;
}

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
    const indikator = parseTreibhausgasemissionen(matchedMaterial['Treibhausgasemissionen, Total,  (in kg CO2-eq)'], matchedMaterial.BAUMATERIALIEN);
    const totalCO2eq = material.volume * density * indikator;

    await BuildingElement.updateOne(
      { "_id": material.buildingElementId, "materials_info.materialId": material.materialId },
      {
        "$set": {
          "materials_info.$.matched_material_id": matchedMaterial._id,
          "materials_info.$.matched_material_name": matchedMaterial.BAUMATERIALIEN,
          "materials_info.$.density": density,
          "materials_info.$.indikator": indikator,
          "materials_info.$.total_co2": totalCO2eq.toFixed(3)
        }
      }
    );
  } else {
    await BuildingElement.updateOne(
      { "_id": material.buildingElementId, "materials_info.materialId": material.materialId },
      {
        "$set": {
          "materials_info.$.matched_material_name": "No Match"
        }
      }
    );
  }
  return matchedMaterial;
}

// Setup Multer for file upload
const upload = multer({ dest: 'uploads/' });

// POST endpoint for IFC file upload and initial material matching
router.post('/api/projects/:projectId/upload', isAuthenticated, upload.single('ifcFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const projectId = req.params.projectId;
  const filePath = req.file.path;

  try {
    // Ensure no old elements for the project
    await BuildingElement.deleteMany({ projectId });

    // Execute the Python script and wait for it to complete
    await new Promise((resolve, reject) => {
      exec(`${process.env.PYTHON_CMD || 'python'} scripts/analyze_ifc.py "${filePath}" "${projectId}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          console.error(`Analysis script stderr: ${stderr}`);
          return reject(new Error(`Python script execution failed: ${stderr}`));
        }
        resolve(stdout);
      });
    });

    // Remove the uploaded file after processing
    await safeUnlink(filePath);

    // Fetch and process building elements
    const buildingElements = await BuildingElement.find({ projectId }).lean();
    const carbonMaterials = await CarbonMaterial.find({}).lean();
    allMaterialsFuse = new Fuse(carbonMaterials, fuseOptions);

    const bulkOps = []; // to collect bulk update operations

    for (const element of buildingElements) {
      if (!element.materials_info) {
        console.warn(`Building element ${element._id} has no materials_info. Initializing as empty array.`);
        element.materials_info = [];
      }

      for (const material of element.materials_info) {
        material.buildingElementId = element._id;
        const bestMatch = await findBestMatchForMaterial(material, carbonMaterials, allMaterialsFuse);
        if (bestMatch) {
          const density = parseDensity(bestMatch['Rohdichte/Flächenmasse'], bestMatch.BAUMATERIALIEN);
          const indikator = parseTreibhausgasemissionen(bestMatch['Treibhausgasemissionen, Total,  (in kg CO2-eq)'], bestMatch.BAUMATERIALIEN);
          const totalCO2eq = material.volume * density * indikator;

          bulkOps.push({
            updateOne: {
              filter: { "_id": element._id, "materials_info.materialId": material.materialId },
              update: {
                "$set": {
                  "materials_info.$.matched_material_id": bestMatch._id,
                  "materials_info.$.matched_material_name": bestMatch.BAUMATERIALIEN,
                  "materials_info.$.density": density,
                  "materials_info.$.indikator": indikator,
                  "materials_info.$.total_co2": totalCO2eq.toFixed(3)
                }
              }
            }
          });
        } else {
          bulkOps.push({
            updateOne: {
              filter: { "_id": element._id, "materials_info.materialId": material.materialId },
              update: {
                "$set": {
                  "materials_info.$.matched_material_name": "No Match"
                }
              }
            }
          });
        }
      }
    }

    // Perform bulk update
    if (bulkOps.length > 0) {
      await BuildingElement.bulkWrite(bulkOps);
    }

    // Calculate total footprint for the project
    const updatedElements = await BuildingElement.find({ projectId }).lean();
    const totalFootprint = updatedElements.reduce((total, element) => {
      if (!element.materials_info) return total; // Skip if no materials_info
      return total + element.materials_info.reduce((elementTotal, material) => {
        return elementTotal + parseFloat(material.total_co2 || 0);
      }, 0);
    }, 0);

    await Project.findByIdAndUpdate(projectId, { totalCarbonFootprint: totalFootprint });

    // Redirect to the project page or send a response to the client
    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    // Remove the uploaded file if there's an error
    await safeUnlink(filePath);
    console.error('Error handling IFC upload:', error);
    res.status(500).json({ error: error.message });
  }
});



// GET endpoint for building elements (no matching, just fetching from DB)
router.get('/api/projects/:projectId/building_elements', isAuthenticated, async (req, res) => {
  try {
      const projectId = req.params.projectId;
      const buildingElements = await BuildingElement.find({ projectId }).lean();
      res.json(buildingElements);
  } catch (error) {
      console.error('Error fetching building elements:', error);
      res.status(500).json({ message: "Error fetching building elements", error: error.toString() });
  }
});

// POST endpoint to update building elements' materials based on user edits
router.post('/api/projects/:projectId/building_elements/update', isAuthenticated, async (req, res) => {
  try {
      const { projectId } = req.params;
      const { materialId, matched_material_name, density, indikator, total_co2 } = req.body;

      // Find and update the specific material within the building element
      const buildingElement = await BuildingElement.findOneAndUpdate(
          { projectId, "materials_info.materialId": materialId },
          {
              "$set": {
                  "materials_info.$.matched_material_name": matched_material_name,
                  "materials_info.$.density": density,
                  "materials_info.$.indikator": indikator,
                  "materials_info.$.total_co2": total_co2,
                  "materials_info.$.matched_material_id": null // Indicate manual change
              }
          },
          { new: true }
      );

      if (buildingElement) {
          // Update the total carbon footprint for the project
          const buildingElements = await BuildingElement.find({ projectId }).lean();
          const totalFootprint = buildingElements.reduce((total, element) => {
              return total + element.materials_info.reduce((elementTotal, material) => {
                  return elementTotal + parseFloat(material.total_co2 || 0);
              }, 0);
          }, 0);

          await Project.findByIdAndUpdate(projectId, { totalCarbonFootprint: totalFootprint });

          res.json({ message: 'Material updated successfully' });
      } else {
          res.status(404).json({ message: 'Building element not found' });
      }
  } catch (error) {
      console.error('Error updating building element:', error);
      res.status(500).json({ message: "Error updating building element", error: error.toString() });
  }
});



// Endpoint to get material names for the dropdown
router.get('/api/materials/names', async (req, res) => {
  try {
    const carbonMaterials = await CarbonMaterial.find({}).lean();
    allMaterialsFuse = new Fuse(carbonMaterials, { keys: ['BAUMATERIALIEN'], threshold: 0.7 });

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
    res.json({ status: 'success', url: `/projects/${project._id}` });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ message: "Error creating project", error: error.toString() });
  }
});

// GET endpoint for fetching all projects
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const projects = await Project.find({ user: userId });
    projects.forEach(project => {
      if (project.EBF && project.totalCarbonFootprint) {
        project.co2PerSquareMeter = (project.totalCarbonFootprint / project.EBF).toFixed(2);
      }
    });
    res.render('dashboard', { projects, query: req.query, page: 'dashboard', formatProjectNameForDisplay });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: "Error fetching projects", error: error.toString() });
  }
});

// GET endpoint for the new project creation form
router.get('/newProject', isAuthenticated, (req, res) => {
  try {
    res.render('newProject', { currentPage: 'newProject' });
  } catch (error) {
    console.error('Error rendering create new project form:', error);
    res.status(500).send('Error rendering create new project form.');
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

// POST endpoint for deleting a project
router.post('/api/projects/:projectId/delete', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    await Project.findByIdAndDelete(projectId);
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
  } catch (error) {
    console.error('Error rendering edit form:', error);
    res.status(500).send('Error rendering edit form.');
  }
});

// POST endpoint for updating a project's details
router.post('/projects/:projectId/edit', isAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  const { name, phase, description, customImage, totalCarbonFootprint, EBF } = req.body;
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
      EBF
    }, { new: true });
    if (!updatedProject) {
      return res.status(404).send('Project not found');
    }
    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).send('Error updating project');
  }
});

// Route to get CO₂-eq data per building storey
router.get('/api/projects/:projectId/co2_per_storey', isAuthenticated, async (req, res) => {
  try {
      const projectId = req.params.projectId;
      const buildingElements = await BuildingElement.find({ projectId }).lean();

      // Aggregate CO₂-eq by building storey
      const storeyCo2Data = buildingElements.reduce((acc, element) => {
          const storey = element.building_storey || 'Unknown';
          const totalCo2 = element.materials_info.reduce((sum, material) => sum + (parseFloat(material.total_co2) || 0), 0);
          
          if (!acc[storey]) {
              acc[storey] = 0;
          }
          acc[storey] += totalCo2;

          return acc;
      }, {});

      // Convert aggregated data into array format
      const result = Object.keys(storeyCo2Data).map(storey => ({
          storey: storey,
          co2_eq: storeyCo2Data[storey]
      }));

      res.json(result);
  } catch (error) {
      console.error('Error fetching CO₂-eq data per building storey:', error);
      res.status(500).json({ message: "Error fetching CO₂-eq data per building storey", error: error.toString() });
  }
});


module.exports = router;
