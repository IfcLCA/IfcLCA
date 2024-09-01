// ------------------------------------------
// Constants and Imports
// ------------------------------------------

const express = require("express");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const router = express.Router();
const Project = require("../models/Project");
const { isAuthenticated } = require("./middleware/authMiddleware");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const Fuse = require("fuse.js");
const BuildingElement = require("../models/BuildingElement");
const CarbonMaterial = require("../models/CarbonMaterial");
const {
  appendTimestampToProjectName,
  formatProjectNameForDisplay,
} = require("../utils/util");
const { isNaN } = require("lodash");
const { route } = require("./authRoutes");

// ------------------------------------------
// Static Routes
// ------------------------------------------

router.get("/contributing", (req, res) => {
  res.render("contributing");
});

router.get("/disclaimer", (req, res) => {
  res.render("disclaimer");
});

// Route for the /opensource page
router.get("/opensource", (req, res) => {
  res.render("opensource");
});

router.get("/terms-and-conditions", (req, res) => {
  res.render("terms-and-conditions");
});

router.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy");
});

// ------------------------------------------
// Helper Functions
// ------------------------------------------
async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to remove file at ${filePath}: ${error.message}`);
  }
}

function parseDensity(density, materialName) {
  if (!density || density.includes("-")) {
    return 0;
  }
  const parsed = parseFloat(density);
  return isNaN(parsed) ? 0 : parsed;
}

function parseTreibhausgasemissionen(value, materialName) {
  if (value === undefined) {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

async function getPriorityFuseInstance(projectId) {
  const project = await Project.findById(projectId).lean();

  if (
    !project ||
    !project.materialPresets ||
    project.materialPresets.length === 0
  ) {
    return null; // No presets available
  }

  const priorityMaterialsList = project.materialPresets.map((preset) => {
    const [ifcMaterial, carbonMaterial] = preset.split("__match__");
    return { BAUMATERIALIEN: carbonMaterial };
  });

  return createFuseInstance(priorityMaterialsList);
}

function findBestPriorityMaterial(materialName) {
  const matches = priorityFuse.search(materialName);
  return matches.length > 0 ? matches[0].item.BAUMATERIALIEN : null;
}

async function findBestMatchForMaterial(
  material,
  carbonMaterials,
  allMaterialsFuse
) {
  const materialNameLower = material.name.toLowerCase();
  const priorityMaterialName = findBestPriorityMaterial(
    materialNameLower,
    priorityFuse
  );
  let matchedMaterial = null;

  if (priorityMaterialName) {
    matchedMaterial = carbonMaterials.find(
      (mat) => mat.BAUMATERIALIEN === priorityMaterialName
    );
  } else {
    const matches = allMaterialsFuse.search(materialNameLower);
    if (matches.length > 0 && matches[0].score < 0.7) {
      matchedMaterial = matches[0].item;
    }
  }

  if (matchedMaterial) {
    const density = parseDensity(
      matchedMaterial["Rohdichte/Flächenmasse"],
      matchedMaterial.BAUMATERIALIEN
    );
    const indikator = parseTreibhausgasemissionen(
      matchedMaterial["Treibhausgasemissionen, Total,  (in kg CO2-eq)"],
      matchedMaterial.BAUMATERIALIEN
    );
    const totalCO2eq = material.volume * density * indikator;

    await BuildingElement.updateOne(
      {
        _id: material.buildingElementId,
        "materials_info.materialId": material.materialId,
      },
      {
        $set: {
          "materials_info.$.matched_material_id": matchedMaterial._id,
          "materials_info.$.matched_material_name":
            matchedMaterial.BAUMATERIALIEN,
          "materials_info.$.density": density,
          "materials_info.$.indikator": indikator,
          "materials_info.$.total_co2": totalCO2eq.toFixed(3),
        },
      }
    );
  } else {
    await BuildingElement.updateOne(
      {
        _id: material.buildingElementId,
        "materials_info.materialId": material.materialId,
      },
      {
        $set: {
          "materials_info.$.matched_material_name": "No Match",
        },
      }
    );
  }
  return matchedMaterial;
}

// ------------------------------------------
// API Routes: File Upload and Material Matching
// ------------------------------------------

// Setup Multer for file upload
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith(".ifc")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

router.post(
  "/api/projects/:projectId/upload",
  isAuthenticated,
  upload.single("ifcFile"),
  async (req, res) => {
    const projectId = req.params.projectId;

    if (!req.file) {
      return res.redirect(
        `/projects/${projectId}?error=Only .ifc files are allowed.`
      );
    }

    const filePath = req.file.path;
    try {
      // Ensure no old elements for the project
      await BuildingElement.deleteMany({ projectId });

      // Skip the Python script execution permanently
      console.log("IFC file uploaded successfully, skipping Python script.");

      // Redirect to the project page
      res.redirect(`/projects/${projectId}`);

      // If not needed anymore, remove the uploaded file after processing
      await safeUnlink(filePath);
    } catch (error) {
      // Remove the uploaded file if there's an error
      await safeUnlink(filePath);
      console.error("Error handling IFC upload:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ------------------------------------------
// API Routes: Project Management
// ------------------------------------------

// GET endpoint for fetching all projects
router.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const projects = await Project.find({ user: userId });
    projects.forEach((project) => {
      if (project.EBF && project.totalCarbonFootprint) {
        project.co2PerSquareMeter = (
          project.totalCarbonFootprint / project.EBF
        ).toFixed(2);
      }
    });
    res.render("dashboard", {
      projects,
      query: req.query,
      page: "dashboard",
      formatProjectNameForDisplay,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res
      .status(500)
      .json({ message: "Error fetching projects", error: error.toString() });
  }
});

// POST endpoint for creating a new project
router.post("/api/projects", isAuthenticated, async (req, res) => {
  try {
    const {
      name,
      phase,
      description,
      customImage,
      totalCarbonFootprint = 0,
      EBF = 0,
    } = req.body;
    const user = req.session.userId;
    const timestampedName = appendTimestampToProjectName(name);

    const project = await Project.create({
      name: timestampedName,
      phase,
      description,
      customImage,
      totalCarbonFootprint,
      user,
      EBF,
    });
    res.json({ status: "success", url: `/projects/${project._id}` });
  } catch (error) {
    console.error("Error creating project:", error);
    res
      .status(400)
      .json({ message: "Error creating project", error: error.toString() });
  }
});

// GET endpoint for the new project creation form
router.get("/newProject", isAuthenticated, (req, res) => {
  try {
    res.render("newProject", { currentPage: "newProject" });
  } catch (error) {
    console.error("Error rendering create new project form:", error);
    res.status(500).send("Error rendering create new project form.");
  }
});

// GET endpoint for a project's detailed page
router.get("/projects/:projectId", isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId).populate(
      "building_elements"
    );
    if (!project) {
      return res.status(404).send("Project not found");
    }

    const EBF = project.EBF || 0;
    const totalCarbonFootprint = project.totalCarbonFootprint || 0;
    const co2PerSquareMeter =
      EBF > 0 ? (totalCarbonFootprint / EBF).toFixed(3) : 0;

    const buildingElements = await BuildingElement.find({
      projectId: project._id,
    });
    let materialsInfo = [];
    buildingElements.forEach((element) => {
      materialsInfo = materialsInfo.concat(
        element.materials_info.map((material) => ({
          ...material,
          instance_name: element.instance_name,
          ifc_class: element.ifc_class,
        }))
      );
    });

    res.render("projectHome", {
      page: "projectHome",
      project: { ...project.toObject(), co2PerSquareMeter },
      materialsInfo,
      formatProjectNameForDisplay,
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).send("Error fetching project details.");
  }
});

// POST endpoint for deleting a project
router.post(
  "/api/projects/:projectId/delete",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      await Project.findByIdAndDelete(projectId);
      res.redirect("/dashboard?deletionSuccess=true");
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).send("Error deleting project.");
    }
  }
);

// GET endpoint for editing a project's details
router.get("/projects/:projectId/edit", isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).send("Project not found");
    }
    res.render("editProject", { project, formatProjectNameForDisplay });
  } catch (error) {
    console.error("Error rendering edit form:", error);
    res.status(500).send("Error rendering edit form.");
  }
});

// POST endpoint for updating a project's details
router.post("/projects/:projectId/edit", isAuthenticated, async (req, res) => {
  const { projectId } = req.params;
  const { name, phase, description, customImage, totalCarbonFootprint, EBF } =
    req.body;
  try {
    if (EBF < 0) {
      throw new Error("Invalid EBF value. EBF must be greater than 0.");
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      {
        name,
        phase,
        description,
        customImage,
        totalCarbonFootprint,
        EBF,
        materialPresets: req.session.materialPresets || [], // Save presets to project
      },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).send("Project not found");
    }

    // Clear the session data after saving
    delete req.session.materialPresets;

    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).send("Error updating project");
  }
});

// Route to display the material presets configuration page
router.get(
  "/projects/:projectId/material-presets",
  isAuthenticated,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).send("Project not found");
      }

      // Load presets from session if available, otherwise from the project
      const materialPresets =
        req.session.materialPresets || project.materialPresets;

      res.render("materialPresets", { project, materialPresets });
    } catch (error) {
      console.error("Error fetching project for material presets:", error);
      res.status(500).send("Error fetching project for material presets.");
    }
  }
);

// POST route to save material presets temporarily in session
router.post(
  "/projects/:projectId/material-presets",
  isAuthenticated,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { ifcMaterials, carbonMaterials } = req.body;

      if (
        !ifcMaterials ||
        !carbonMaterials ||
        ifcMaterials.length !== carbonMaterials.length
      ) {
        return res
          .status(400)
          .send(
            "Invalid input. Please provide both IFC and Carbon Database names."
          );
      }

      const materialPresets = ifcMaterials.map((ifcMaterial, index) => {
        const carbonMaterial = carbonMaterials[index] || "";
        return `${ifcMaterial}__match__${carbonMaterial}`;
      });

      // Store the presets in the session instead of saving to the database
      req.session.materialPresets = materialPresets;

      res.redirect(`/projects/${projectId}/edit`);
    } catch (error) {
      console.error("Error saving material presets:", error);
      res.status(500).send("Error saving material presets.");
    }
  }
);

// Route to cancel project edit and clear session data
router.get("/projects/:projectId/cancel-edit", isAuthenticated, (req, res) => {
  const { projectId } = req.params;

  // Clear the session data for material presets
  delete req.session.materialPresets;

  // Redirect back to the project page or dashboard
  res.redirect(`/projects/${projectId}`);
});

// ------------------------------------------
// API Routes: Table Management
// ------------------------------------------

// Add new building element row page
router.get("/projects/:projectId/add-row", isAuthenticated, (req, res) => {
  try {
    const projectId = req.params.projectId;
    res.render("addRow", { projectId });
  } catch (error) {
    console.error("Error rendering add row page:", error);
    res.status(500).send("Error rendering add row page.");
  }
});

// POST endpoint to add a new building element row
router.post(
  "/api/projects/:projectId/building_elements/add",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { name, volume, material, totalCO2, density, indicator } = req.body; // Extract density and indicator

      const newElement = new BuildingElement({
        projectId: new mongoose.Types.ObjectId(projectId),
        guid: new mongoose.Types.ObjectId().toHexString(), // Generate a unique GUID
        ifc_class: "CustomElement",
        instance_name: name,
        building_storey: "Unknown",
        is_loadbearing: false,
        is_external: false,
        materials_info: [
          {
            materialId: new mongoose.Types.ObjectId().toHexString(),
            volume: volume,
            name: material,
            matched_material_name: material,
            density: density, // Use extracted density
            indikator: indicator, // Use extracted indicator
            total_co2: totalCO2,
          },
        ],
      });

      await newElement.save();

      // Update project total CO₂ footprint
      const project = await Project.findById(projectId);
      project.totalCarbonFootprint += parseFloat(totalCO2);
      await project.save();

      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      console.error("Error adding building element:", error);
      res.status(500).json({
        message: "Error adding building element",
        error: error.toString(),
      });
    }
  }
);

router.post(
  "/api/projects/:projectId/building_elements/updateDensity",
  isAuthenticated,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { materialId, density, total_co2 } = req.body;

      const buildingElement = await BuildingElement.findOneAndUpdate(
        { projectId, "materials_info.materialId": materialId },
        {
          $set: {
            "materials_info.$.density": density,
            "materials_info.$.total_co2": total_co2,
          },
        },
        { new: true }
      );

      if (buildingElement) {
        const buildingElements = await BuildingElement.find({
          projectId,
        }).lean();
        const totalFootprint = buildingElements.reduce((total, element) => {
          return (
            total +
            element.materials_info.reduce((elementTotal, material) => {
              return elementTotal + parseFloat(material.total_co2 || 0);
            }, 0)
          );
        }, 0);

        const project = await Project.findById(projectId);
        project.totalCarbonFootprint = totalFootprint;
        const EBF = project.EBF || 1; // Ensure EBF is not zero
        const co2PerSquareMeter = totalFootprint / EBF;

        await project.save();

        res.json({
          message: "Density updated successfully",
          totalCarbonFootprint: totalFootprint,
          EBF: EBF,
          co2PerSquareMeter: co2PerSquareMeter, // Include in response
        });
      } else {
        res.status(404).json({ message: "Building element not found" });
      }
    } catch (error) {
      console.error("Error updating density:", error);
      res
        .status(500)
        .json({ message: "Error updating density", error: error.toString() });
    }
  }
);

// GET endpoint for building elements (no matching, just fetching from DB)
router.get(
  "/api/projects/:projectId/building_elements",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const buildingElements = await BuildingElement.find({ projectId }).lean();
      res.json(buildingElements);
    } catch (error) {
      console.error("Error fetching building elements:", error);
      res.status(500).json({
        message: "Error fetching building elements",
        error: error.toString(),
      });
    }
  }
);

// POST endpoint to update building elements' materials based on user edits
router.post(
  "/api/projects/:projectId/building_elements/update",
  isAuthenticated,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const {
        materialId,
        matched_material_name,
        density,
        indikator,
        total_co2,
      } = req.body;

      const buildingElement = await BuildingElement.findOneAndUpdate(
        { projectId, "materials_info.materialId": materialId },
        {
          $set: {
            "materials_info.$.matched_material_name": matched_material_name,
            "materials_info.$.density": density,
            "materials_info.$.indikator": indikator,
            "materials_info.$.total_co2": total_co2,
            "materials_info.$.matched_material_id": null,
          },
        },
        { new: true }
      );

      if (buildingElement) {
        const buildingElements = await BuildingElement.find({
          projectId,
        }).lean();
        const totalFootprint = buildingElements.reduce((total, element) => {
          return (
            total +
            element.materials_info.reduce((elementTotal, material) => {
              return elementTotal + parseFloat(material.total_co2 || 0);
            }, 0)
          );
        }, 0);

        const project = await Project.findById(projectId);
        project.totalCarbonFootprint = totalFootprint;
        const EBF = project.EBF || 1; // Ensure EBF is not zero
        const co2PerSquareMeter = totalFootprint / EBF;

        await project.save();

        res.json({
          message: "Material updated successfully",
          totalCarbonFootprint: totalFootprint,
          EBF: EBF,
          co2PerSquareMeter: co2PerSquareMeter, // Include in response
        });
      } else {
        res.status(404).json({ message: "Building element not found" });
      }
    } catch (error) {
      console.error("Error updating building element:", error);
      res.status(500).json({
        message: "Error updating building element",
        error: error.toString(),
      });
    }
  }
);

// POST endpoint to delete specific materials from building elements
router.post(
  "/api/projects/:projectId/building_elements/materials/delete",
  isAuthenticated,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { materialIds } = req.body; // Get the material IDs to delete

      // Find building elements containing the specified materials
      const buildingElements = await BuildingElement.find({
        "materials_info.materialId": { $in: materialIds },
        projectId,
      });

      // Track total CO2 removed
      let totalCo2Removed = 0;

      // Update or delete building elements
      for (const element of buildingElements) {
        const remainingMaterials = element.materials_info.filter(
          (material) => !materialIds.includes(material.materialId.toString())
        );

        if (remainingMaterials.length === 0) {
          // If no materials remain, delete the entire building element
          totalCo2Removed += element.materials_info.reduce(
            (sum, material) => sum + parseFloat(material.total_co2 || 0),
            0
          );
          await BuildingElement.deleteOne({ _id: element._id });
        } else {
          // Otherwise, update the element with remaining materials
          totalCo2Removed += element.materials_info.reduce((sum, material) => {
            if (materialIds.includes(material.materialId.toString())) {
              return sum + parseFloat(material.total_co2);
            }
            return sum;
          }, 0);
          element.materials_info = remainingMaterials;
          await element.save();
        }
      }

      // Update project's total carbon footprint
      const project = await Project.findById(projectId);
      project.totalCarbonFootprint -= totalCo2Removed;
      await project.save();

      res.json({ message: "Materials deleted successfully" });
    } catch (error) {
      console.error("Error deleting materials:", error);
      res
        .status(500)
        .json({ message: "Error deleting materials", error: error.toString() });
    }
  }
);

// Endpoint to get material names for the dropdown
router.get("/api/materials/names", async (req, res) => {
  try {
    const carbonMaterials = await CarbonMaterial.find({}).lean();
    allMaterialsFuse = new Fuse(carbonMaterials, {
      keys: ["BAUMATERIALIEN"],
      threshold: 0.7,
    });

    let results = carbonMaterials.map((material) => material.BAUMATERIALIEN);
    if (req.query.search) {
      results = allMaterialsFuse
        .search(req.query.search)
        .map((result) => result.item.BAUMATERIALIEN);
    }

    res.json(results);
  } catch (error) {
    console.error("Failed to fetch material names:", error);
    res.status(500).send("Error fetching material names");
  }
});

// Endpoint to get detailed properties of a material by name
router.get(
  "/api/materials/details/:name",
  isAuthenticated,
  async (req, res) => {
    try {
      const materialName = req.params.name;
      const material = await CarbonMaterial.findOne({
        BAUMATERIALIEN: materialName,
      }).lean();

      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      const density = parseDensity(
        material["Rohdichte/Flächenmasse"],
        materialName
      );
      const indicator = parseTreibhausgasemissionen(
        material["Treibhausgasemissionen, Total,  (in kg CO2-eq)"],
        materialName
      );

      res.json({
        density: density,
        indicator: indicator,
      });
    } catch (error) {
      console.error("Failed to fetch material details:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ------------------------------------------
// API Routes: Export functionality
// ------------------------------------------

// GET endpoint for exporting project data to Excel
router.get(
  "/api/projects/:projectId/export",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await Project.findById(projectId).lean();
      const buildingElements = await BuildingElement.find({ projectId }).lean();

      if (!project || buildingElements.length === 0) {
        return res
          .status(404)
          .send("Project not found or no building elements available");
      }

      // Create a new workbook and add the LCA worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheetLCA = workbook.addWorksheet("LCA");

      const now = new Date();
      const formattedDate = now.toLocaleString("de-CH"); // Formatting as per Swiss locale
      const timestamp = now
        .toISOString()
        .split("T")[1]
        .replace(/:/g, "-")
        .split(".")[0]; // HH-MM-SS format

      // Add column headers in the LCA sheet (row 1)
      worksheetLCA.columns = [
        { header: "GUID", key: "guid", width: 20 },
        { header: "IfcClass", key: "ifc_class", width: 15 },
        { header: "Name", key: "instance_name", width: 30 },
        { header: "Building-Storey", key: "building_storey", width: 20 },
        { header: "Load-bearing", key: "is_loadbearing", width: 15 },
        { header: "External", key: "is_external", width: 15 },
        { header: "Volume", key: "volume", width: 15 },
        { header: "Material", key: "name", width: 30 },
        { header: "Matched Material", key: "matched_material", width: 30 },
        { header: "Density (kg/m³)", key: "density", width: 20 },
        { header: "Indicator (kg CO₂-eq/kg)", key: "indikator", width: 25 },
        { header: "CO₂-eq (kg)", key: "total_co2", width: 20 },
      ];

      // Add rows for each building element to the LCA sheet
      buildingElements.forEach((element) => {
        element.materials_info.forEach((material) => {
          worksheetLCA.addRow({
            guid: element.guid,
            ifc_class: element.ifc_class,
            instance_name: element.instance_name,
            building_storey: element.building_storey,
            is_loadbearing: element.is_loadbearing ? "Yes" : "No",
            is_external: element.is_external ? "Yes" : "No",
            volume: material.volume,
            name: material.name,
            matched_material: material.matched_material_name || "No Match",
            density: material.density || 0,
            indikator: material.indikator || 0,
            total_co2: material.total_co2 || 0,
          });
        });
      });

      // Create a second sheet called "Project Info" and add metadata
      const worksheetProjectInfo = workbook.addWorksheet("Project Info");

      worksheetProjectInfo.addRow([`Exported on: ${formattedDate}`]);
      worksheetProjectInfo.addRow([
        `Project Name: ${formatProjectNameForDisplay(project.name)}`,
        `Project Description: ${project.description || "N/A"}`,
        `Project Phase: ${project.phase || "N/A"}`,
      ]);

      worksheetProjectInfo.addRow([]); // Empty row for spacing, if needed

      // Set up the file name using the display name of the project and only the date
      const fileNameDate = now.toISOString().split("T")[0]; // Only the date part
      const fileName = `${formatProjectNameForDisplay(
        project.name
      )}_${fileNameDate}.xlsx`;

      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      // Write the workbook to the response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error exporting project data:", error);
      res.status(500).send("Error exporting project data");
    }
  }
);

// ------------------------------------------
// API Routes: Graph data
// ------------------------------------------

// Route to get CO₂-eq data per building storey
router.get(
  "/api/projects/:projectId/co2_per_storey",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await Project.findById(projectId).lean(); // Fetch project to get EBF
      const buildingElements = await BuildingElement.find({ projectId }).lean();
      const EBF = project.EBF || 1; // Ensure EBF is not zero

      // Aggregate CO₂-eq by building storey
      const storeyCo2Data = buildingElements.reduce((acc, element) => {
        const storey = element.building_storey || "Unknown";
        const totalCo2 = element.materials_info.reduce(
          (sum, material) => sum + (parseFloat(material.total_co2) || 0),
          0
        );

        if (!acc[storey]) {
          acc[storey] = 0;
        }
        acc[storey] += totalCo2;

        return acc;
      }, {});

      // Convert aggregated data into array format
      const result = Object.keys(storeyCo2Data).map((storey) => ({
        storey: storey,
        co2_eq: storeyCo2Data[storey] / EBF, // Divide by EBF to get CO₂-eq per m²
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching CO₂-eq data per building storey:", error);
      res.status(500).json({
        message: "Error fetching CO₂-eq data per building storey",
        error: error.toString(),
      });
    }
  }
);

module.exports = router;
