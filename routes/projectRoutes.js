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
const cron = require("node-cron");

const UPLOADS_DIR = path.resolve(__dirname, "../uploads"); // Define the safe root directory for uploads

// Deleting all uploaded Ifc after 24 hours
async function cleanupOldIFCFiles() {
  const uploadsDir = path.join(__dirname, "..", "uploads");
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  try {
    const files = await fs.readdir(uploadsDir);
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtime.getTime() > oneDay) {
        await fs.unlink(filePath);
        console.log(`Deleted old IFC file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up old IFC files:", error);
  }
}

// Schedule the cleanup task to run daily at midnight
cron.schedule("0 0 * * *", () => {
  cleanupOldIFCFiles();
});

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

function formatCarbonFootprint(value) {
  if (value < 2000) {
    return `${Math.round(value).toLocaleString()} kg`;
  } else if (value < 1500000) {
    return `${(value / 1000).toFixed(1).toLocaleString()} tons`;
  } else {
    return `${(value / 1000000).toFixed(3).toLocaleString()} Mio tons`;
  }
}

// Inject this function into the res.locals so it can be used in EJS templates
router.use((req, res, next) => {
  res.locals.formatCarbonFootprint = formatCarbonFootprint;
  next();
});

async function safeUnlink(filePath) {
  try {
    // Resolve the file path relative to the uploads directory
    const resolvedPath = path.resolve(UPLOADS_DIR, filePath);

    // Ensure the resolved path is within the uploads directory
    if (!resolvedPath.startsWith(UPLOADS_DIR)) {
      throw new Error("Invalid file path: Path traversal detected");
    }

    // Unlink the file safely
    await fs.unlink(resolvedPath);
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

// Priority materials map and Fuse.js settings
const priorityMaterials = {
  Beton: "Hochbaubeton (ohne Bewehrung)",
  Holzwerkstoffplatte: "3- und 5-Schicht Massivholzplatte",
  Holz: "Brettschichtholz",
  CLT: "Brettsperrholz",
  Stahl: "Stahlprofil, blank",
  S235: "Stahlprofil, blank",
  S355: "Stahlprofil, blank",
  S335: "Stahlprofil, blank",
  S335J0: "Stahlprofil, blank",
  Beton_vorfabriziert: "Betonfertigteil, hochfester Beton, ab Werk",
};

const fuseOptions = {
  keys: ["BAUMATERIALIEN"],
  threshold: 0.7,
  includeScore: true,
  shouldSort: true,
};

const priorityMaterialsList = Object.values(priorityMaterials).map(
  (material) => ({ BAUMATERIALIEN: material })
);
const priorityFuse = new Fuse(priorityMaterialsList, fuseOptions);
let allMaterialsFuse;

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
  const priorityMaterialName = findBestPriorityMaterial(materialNameLower);
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
      matchedMaterial["Rohdichte/ Flächenmasse"],
      matchedMaterial.BAUMATERIALIEN
    );
    const indikator = parseTreibhausgasemissionen(
      matchedMaterial["Treibhausgasemissionen, Total [kg CO2-eq]"],
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

// POST endpoint for IFC file upload and initial material matching
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
    const userId = req.session.userId;

    try {
      // Create a user-specific directory for IFC files
      const userDir = path.join(__dirname, "..", "uploads", userId);
      await fs.mkdir(userDir, { recursive: true });

      // Move the uploaded file to the user-specific directory
      const newFilePath = path.join(userDir, `${projectId}.ifc`);
      await fs.rename(filePath, newFilePath);

      // Update the project document with the new file path
      await Project.findByIdAndUpdate(projectId, {
        ifc_file_path: newFilePath,
      });

      // Ensure no old elements for the project
      await BuildingElement.deleteMany({ projectId });

      // Determine if this is production or preview based on environment variable
      const environment = process.env.NODE_ENV || "production"; // Fallback to production if NODE_ENV is not set

      // Use different Python paths and script paths based on environment
      const pythonPath = "/opt/miniconda3/bin/python"; // Assuming Python path stays the same for both

      // Set script path and working directory based on environment
      const scriptPath =
        environment === "production"
          ? "/var/www/ifclca/IfcLCA/scripts/analyze_ifc.py"
          : "/var/www/preview/scripts/analyze_ifc.py"; // Update for preview path

      const workingDirectory =
        environment === "production"
          ? "/var/www/ifclca/IfcLCA"
          : "/var/www/preview"; // Update for preview working directory

      // Execute the Python script and wait for it to complete
      await new Promise((resolve, reject) => {
        const args = [scriptPath, filePath, projectId];

        const subprocess = spawn(pythonPath, args, {
          cwd: workingDirectory, // Dynamically set the working directory
        });

        subprocess.stdout.on("data", (data) => {
          console.log(`stdout: ${data}`);
        });

        subprocess.stderr.on("data", (data) => {
          console.error(`stderr: ${data}`);
        });

        subprocess.on("close", (code) => {
          if (code !== 0) {
            return reject(new Error(`Python script exited with code ${code}`));
          }
          resolve(); // Resolve without passing stdoutData
        });
      });

      // Fetch and process building elements
      const buildingElements = await BuildingElement.find({ projectId }).lean();
      const carbonMaterials = await CarbonMaterial.find({}).lean();
      allMaterialsFuse = new Fuse(carbonMaterials, fuseOptions);

      const bulkOps = []; // to collect bulk update operations

      for (const element of buildingElements) {
        if (!element.materials_info) {
          console.warn(
            `Building element ${element._id} has no materials_info. Initializing as empty array.`
          );
          element.materials_info = [];
        }

        for (const material of element.materials_info) {
          material.buildingElementId = element._id;
          const bestMatch = await findBestMatchForMaterial(
            material,
            carbonMaterials,
            allMaterialsFuse
          );
          if (bestMatch) {
            const density = parseDensity(
              bestMatch["Rohdichte/ Flächenmasse"],
              bestMatch.BAUMATERIALIEN
            );
            const indikator = parseTreibhausgasemissionen(
              bestMatch["Treibhausgasemissionen, Total [kg CO2-eq]"],
              bestMatch.BAUMATERIALIEN
            );
            const totalCO2eq = material.volume * density * indikator;

            bulkOps.push({
              updateOne: {
                filter: {
                  _id: element._id,
                  "materials_info.materialId": material.materialId,
                },
                update: {
                  $set: {
                    "materials_info.$.matched_material_id": bestMatch._id,
                    "materials_info.$.matched_material_name":
                      bestMatch.BAUMATERIALIEN,
                    "materials_info.$.density": density,
                    "materials_info.$.indikator": indikator,
                    "materials_info.$.total_co2": totalCO2eq.toFixed(3),
                  },
                },
              },
            });
          } else {
            bulkOps.push({
              updateOne: {
                filter: {
                  _id: element._id,
                  "materials_info.materialId": material.materialId,
                },
                update: {
                  $set: {
                    "materials_info.$.matched_material_name": "No Match",
                  },
                },
              },
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
        return (
          total +
          element.materials_info.reduce((elementTotal, material) => {
            return elementTotal + parseFloat(material.total_co2 || 0);
          }, 0)
        );
      }, 0);

      await Project.findByIdAndUpdate(projectId, {
        totalCarbonFootprint: totalFootprint,
      });

      // Redirect to the project page or send a response to the client
      res.redirect(`/projects/${projectId}`);
    } catch (error) {
      console.error("Error handling IFC upload:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// IFC export
router.get(
  "/api/projects/:projectId/export-ifc",
  isAuthenticated,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).render("error", {
          message: "Project not found",
          error: {
            status: 404,
            stack: "The requested project could not be found.",
          },
          projectId: projectId,
        });
      }

      if (!project.ifc_file_path || !fs.existsSync(project.ifc_file_path)) {
        return res.status(404).render("error", {
          message: "IFC file not found",
          error: {
            status: 404,
            stack:
              "The original IFC file for this project is no longer available. " +
              "Please note that we only retain uploaded IFC files for 24 hours during Beta. " +
              "If you need to export the IFC file, please re-upload it to the project.",
          },
          projectId: projectId,
        });
      }

      const scriptPath = path.join(__dirname, "..", "scripts", "export_ifc.py");
      const outputPath = path.join(
        __dirname,
        "..",
        "temp",
        `${project.name}_export.ifc`
      );

      const pythonProcess = spawn("python", [
        scriptPath,
        projectId,
        outputPath,
      ]);

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          return res.status(500).send("Error exporting IFC file");
        }

        res.download(outputPath, `${project.name}_export.ifc`, (err) => {
          if (err) {
            console.error("Error sending file:", err);
          }
          // Delete the temporary export file after sending
          fs.unlink(outputPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting temporary file:", unlinkErr);
            }
          });
        });
      });
    } catch (error) {
      console.error("Error exporting IFC data:", error);
      res.status(500).render("error", {
        message: "Error exporting IFC data",
        error: {
          status: 500,
          stack:
            "An unexpected error occurred. Please try again later or contact support if the problem persists.",
        },
        projectId: req.params.projectId,
      });
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
      },
      { new: true }
    );
    if (!updatedProject) {
      return res.status(404).send("Project not found");
    }
    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).send("Error updating project");
  }
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
      const materialName = decodeURIComponent(req.params.name); // Decode the material name
      const material = await CarbonMaterial.findOne({
        BAUMATERIALIEN: materialName,
      }).lean();

      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      const density = parseDensity(
        material["Rohdichte/ Flächenmasse"],
        materialName
      );
      const indicator = parseTreibhausgasemissionen(
        material["Treibhausgasemissionen, Total [kg CO2-eq]"],
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
