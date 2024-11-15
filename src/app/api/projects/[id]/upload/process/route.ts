import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material, KBOBMaterial } from "@/models";
import mongoose from "mongoose";
import { IFCParser } from "@/lib/services/ifc-parser";
import { MaterialService } from "@/lib/services/material-service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

interface IFCElement {
  materialLayers?: {
    layers?: Array<{
      materialName?: string;
      thickness?: number;
      layerId?: string;
      layerName?: string;
    }>;
    layerSetName?: string;
  };
  globalId: string;
  name: string;
  type: string;
  netVolume?: number;
  spatialContainer?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let uploadId: string | undefined;
  try {
    // Validate request body
    const body = await request.json();
    if (!body.uploadId || !body.content) {
      logger.error("Invalid request body", { body });
      return NextResponse.json(
        { error: "Missing required fields: uploadId and content" },
        { status: 400 }
      );
    }
    uploadId = body.uploadId;

    // Connect to database
    try {
      await connectToDatabase();
    } catch (error: any) {
      logger.error("Database connection failed", { error: error.message });
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Validate project ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      logger.error("Invalid project ID format", { projectId: params.id });
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const projectId = params.id;
    
    // Find upload
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      logger.error("Upload not found", { uploadId });
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Parse IFC content
    logger.info("Starting IFC parsing", {
      projectId,
      uploadId,
      contentLength: body.content.length
    });
    
    const parser = new IFCParser();
    let elements;
    try {
      elements = parser.parseContent(body.content);
      logger.info(`Parsed ${elements.length} elements from IFC`, {
        firstElement: elements[0] ? {
          id: elements[0].globalId,
          type: elements[0].type,
          hasLayers: !!elements[0].materialLayers?.layers
        } : null
      });
    } catch (error: any) {
      logger.error("IFC parsing failed", {
        error: error.message,
        uploadId
      });
      throw new Error(`IFC parsing failed: ${error.message}`);
    }

    // Extract and process materials
    logger.info("Extracting materials from layers");
    const materialsToProcess = elements.flatMap((element: IFCElement) => {
      const layers = element.materialLayers?.layers;
      if (!layers || !Array.isArray(layers)) {
        logger.warn(`No valid layers found for element`, {
          id: element.globalId,
          type: element.type
        });
        return [];
      }

      const uniqueMaterials = new Map();
      layers.forEach((layer) => {
        if (layer.materialName) {
          const existingMaterial = uniqueMaterials.get(layer.materialName);
          const newVolume = (existingMaterial?.volume || 0) + (layer.thickness || 0);
          
          uniqueMaterials.set(layer.materialName, {
            name: layer.materialName,
            category: element.materialLayers?.layerSetName,
            volume: newVolume,
          });
          
          logger.debug(`Updated material "${layer.materialName}"`, {
            category: element.materialLayers?.layerSetName,
            newVolume,
            layerThickness: layer.thickness
          });
        } else {
          logger.warn(`Layer missing material name`, layer);
        }
      });

      return Array.from(uniqueMaterials.values());
    });

    logger.info(`Found ${materialsToProcess.length} unique materials to process`);

    // Clean material name function
    const cleanMaterialName = (name: string) => {
      return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    };

    // Find existing material matches across all projects
    const existingMaterialMatches = await Promise.all(
      materialsToProcess.map(async (material) => {
        const cleanedName = cleanMaterialName(material.name);
        logger.debug(`Searching for material match across all projects`, {
          originalName: material.name,
          cleanedName: cleanedName
        });

        // Find first matching material from any project by comparing cleaned names
        const existingMaterials = await Material.find({})
          .populate('kbobMatchId')  // Populate the KBOB data
          .sort({ createdAt: 1 });
          
        const existingMaterial = existingMaterials.find(m => 
          cleanMaterialName(m.name) === cleanedName
        );

        if (existingMaterial && existingMaterial.kbobMatchId) {
          logger.debug(`Found existing material match with KBOB data`, {
            originalName: material.name,
            matchedName: existingMaterial.name,
            projectId: existingMaterial.projectId,
            kbobMatch: {
              name: existingMaterial.kbobMatchId.Name,
              density: existingMaterial.kbobMatchId['kg/unit'] || 
                (existingMaterial.kbobMatchId['min density'] && existingMaterial.kbobMatchId['max density'] ? 
                  (existingMaterial.kbobMatchId['min density'] + existingMaterial.kbobMatchId['max density']) / 2 : 
                  undefined)
            }
          });

          return {
            ...material,
            kbobMatch: existingMaterial.kbobMatchId,
            autoMatched: existingMaterial.autoMatched,
            matchScore: existingMaterial.matchScore
          };
        }

        // If no match found, proceed with KBOB matching
        logger.debug(`No existing material match found, proceeding with KBOB matching`, {
          materialName: material.name
        });
        return material;
      })
    );

    // Update materialMatches with existing matches
    let materialMatches = existingMaterialMatches;

    // Only proceed with KBOB matching for materials without existing matches
    const unmatchedMaterials = materialMatches.filter(m => !m.kbobMatch);
    
    logger.info(`Starting material matching process for remaining unmatched materials`, {
      total: materialMatches.length,
      unmatched: unmatchedMaterials.length,
      alreadyMatched: materialMatches.length - unmatchedMaterials.length
    });

    // Proceed with KBOB matching only for unmatched materials
    let matchedCount = materialMatches.length - unmatchedMaterials.length;
    for (const material of unmatchedMaterials) {
      try {
        const match = await MaterialService.findBestKBOBMatch(material.name);
        if (match) {
          logger.info(`Found KBOB match for "${material.name}"`, {
            kbobName: match.kbobMaterial.Name,
            score: match.score,
            category: match.kbobMaterial.Category
          });
          materialMatches = materialMatches.map(m => m.name === material.name ? {
            ...m,
            kbobMatch: match.kbobMaterial,
            matchScore: match.score
          } : m);
          matchedCount++;
        } else {
          logger.warn(`No KBOB match found for "${material.name}"`);
        }
      } catch (error: any) {
        logger.error(`Error matching material "${material.name}"`, {
          error: error.message
        });
      }
    }

    logger.info(`Material matching complete`, {
      totalMaterials: materialsToProcess.length,
      matchedMaterials: matchedCount,
      unmatchedMaterials: materialsToProcess.length - matchedCount
    });

    // Group materials by name and aggregate their volumes
    const materialsByName = materialMatches.reduce((acc: any, material: any) => {
      const key = material.name;
      if (!acc[key]) {
        acc[key] = {
          ...material,
          volume: material.volume || 0
        };
      } else {
        acc[key].volume += (material.volume || 0);
      }
      return acc;
    }, {});

    // Save materials with update for duplicates
    const savedMaterials = await Promise.all(
      Object.values(materialsByName).map(async (material: any) => {
        const materialData = {
          projectId: projectId,
          name: material.name,
          category: material.category,
          kbobMatchId: material.kbobMatch?._id,
          gwp: material.kbobMatch?.GWP || 0,
          ubp: material.kbobMatch?.UBP || 0,
          penre: material.kbobMatch?.PENRE || 0,
          autoMatched: !!material.kbobMatch,
          matchScore: material.matchScore || 0,
        };

        // First try to find existing material
        let existingMaterial = await Material.findOne({
          name: material.name,
          projectId: projectId
        });

        if (existingMaterial) {
          // Update existing material
          logger.debug(`Updating existing material: ${material.name}`, {
            currentVolume: existingMaterial.volume,
            addedVolume: material.volume || 0
          });
          
          existingMaterial.volume = (existingMaterial.volume || 0) + (material.volume || 0);
          existingMaterial.set(materialData);
          return await existingMaterial.save();
        } else {
          // Create new material
          logger.debug(`Creating new material: ${material.name}`, {
            volume: material.volume || 0
          });
          
          return await Material.create({
            ...materialData,
            volume: material.volume || 0
          });
        }
      })
    );
    logger.info(`Saved ${savedMaterials.length} materials to database`);

    // Save elements with update for duplicates
    const savedElements = await Promise.all(
      elements.map(async (element: any) => {
        // Get all materials for this project to reference them
        const projectMaterials = await Material.find({ projectId: projectId })
          .populate('kbobMatchId'); // Make sure to populate KBOB data

        // Calculate indicators for each material in the element
        const materialsWithIndicators = (element.materialLayers?.layers || []).map((material: any) => {
          // Find the saved material in the database
          const savedMaterial = projectMaterials.find(m => m.name === material.materialName);
          
          if (savedMaterial && savedMaterial.kbobMatchId) {
            // Calculate volume based on layer thickness and element net volume
            const layerThickness = material.thickness || 0;
            const totalThickness = element.materialLayers?.layers.reduce((sum: number, layer: any) => sum + (layer.thickness || 0), 0) || 1;
            const volumeFraction = layerThickness / totalThickness;
            const volume = (element.netVolume || 0) * volumeFraction;

            // Get density from KBOB data
            let density = 0;
            const kbobData = savedMaterial.kbobMatchId;
            
            if (typeof kbobData['kg/unit'] === 'number') {
              density = kbobData['kg/unit'];
            } else if (typeof kbobData['min density'] === 'number' && 
                     typeof kbobData['max density'] === 'number') {
              density = (kbobData['min density'] + kbobData['max density']) / 2;
            }

            // Calculate mass in tons (volume in m³, density in kg/m³)
            const mass = volume * density / 1000; // Convert kg to tons

            // Calculate indicators (KBOB values are per ton)
            const indicators = {
              gwp: (kbobData.GWP || 0) * mass,
              ubp: (kbobData.UBP || 0) * mass,
              penre: (kbobData.PENRE || 0) * mass
            };

            logger.debug(`Material indicators calculated`, {
              materialName: material.materialName,
              layerThickness,
              totalThickness,
              volumeFraction,
              elementNetVolume: element.netVolume,
              volume,
              density,
              mass,
              kbobValues: {
                gwp: kbobData.GWP,
                ubp: kbobData.UBP,
                penre: kbobData.PENRE
              },
              calculatedIndicators: indicators
            });

            return {
              material: savedMaterial._id,
              name: material.materialName,
              volume: volume,
              thickness: material.thickness,
              density: density,
              mass: mass,
              indicators
            };
          }
          return {
            name: material.materialName,
            volume: material.thickness || 0,
            thickness: material.thickness,
            density: 0,
            mass: 0,
            indicators: {
              gwp: 0,
              ubp: 0,
              penre: 0
            }
          };
        });

        // Calculate total indicators for the element
        const totalIndicators = materialsWithIndicators.reduce((acc: any, material: any) => {
          return {
            gwp: acc.gwp + (material.indicators?.gwp || 0),
            ubp: acc.ubp + (material.indicators?.ubp || 0),
            penre: acc.penre + (material.indicators?.penre || 0)
          };
        }, { gwp: 0, ubp: 0, penre: 0 });

        const elementData = {
          projectId: projectId,
          guid: element.globalId,
          name: element.name,
          type: element.type,
          volume: element.netVolume,
          buildingStorey: element.spatialContainer,
          materials: materialsWithIndicators,
          indicators: totalIndicators
        };

        logger.debug(`Element indicators calculated`, {
          elementName: element.name,
          materialCount: materialsWithIndicators.length,
          totalMass: materialsWithIndicators.reduce((acc, m) => acc + (m.mass || 0), 0),
          totalIndicators,
          materialDetails: materialsWithIndicators.map(m => ({
            name: m.name,
            volume: m.volume,
            density: m.density,
            mass: m.mass,
            indicators: m.indicators
          }))
        });

        // First try to find existing element
        let existingElement = await Element.findOne({
          guid: element.globalId,
          projectId: projectId
        });

        if (existingElement) {
          // Update existing element
          logger.debug(`Updating existing element: ${element.name}`, {
            guid: element.globalId,
            type: element.type
          });
          
          existingElement.set(elementData);
          return await existingElement.save();
        } else {
          // Create new element
          logger.debug(`Creating new element: ${element.name}`, {
            guid: element.globalId,
            type: element.type
          });
          
          return await Element.create(elementData);
        }
      })
    );
    logger.info(`Saved ${savedElements.length} elements to database`);

    // Update upload with counts
    upload.status = "Completed";
    upload.elements = elements;
    upload.materials = materialMatches;
    upload.elementCount = savedElements.length;
    upload.materialCount = savedMaterials.length;
    await upload.save();
    logger.info("Upload results saved successfully", { uploadId });

    return NextResponse.json({
      success: true,
      elementCount: elements.length,
      materialCount: materialsToProcess.length,
      matchedMaterialCount: matchedCount
    });
  } catch (error: any) {
    logger.error("Error processing upload", {
      error: error.message,
      stack: error.stack,
      uploadId
    });

    if (uploadId) {
      try {
        const upload = await Upload.findById(uploadId);
        if (upload) {
          upload.status = "Failed";
          upload.error = error.message;
          await upload.save();
          logger.info("Updated upload status to error", { uploadId });
        }
      } catch (saveError: any) {
        logger.error("Error saving upload error status", {
          error: saveError.message,
          uploadId
        });
      }
    }

    return NextResponse.json(
      { error: error.message || "Error processing upload" },
      { status: 500 }
    );
  }
}
