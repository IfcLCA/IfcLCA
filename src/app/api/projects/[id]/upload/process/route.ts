import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material, MaterialUsage } from "@/models";
import mongoose from "mongoose";
import { IFCParser } from "@/lib/services/ifc-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

// Add this interface near the top of the file
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

// Add interfaces for type safety
interface MaterialLayer {
  materialName?: string;
  thickness?: number;
  layerId?: string;
  layerName?: string;
}

interface SavedMaterial {
  _id: mongoose.Types.ObjectId;
  name: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let uploadId: string | undefined;
  try {
    await connectToDatabase();
    const { uploadId: reqUploadId, content } = await request.json();
    uploadId = reqUploadId;

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const projectId = new mongoose.Types.ObjectId(params.id);
    const upload = await Upload.findById(uploadId);

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Parse IFC content
    const parser = new IFCParser();
    const elements = parser.parseContent(content);

    // Store total element count before any filtering
    const totalElementCount = elements.length;

    console.log("Processing elements:", JSON.stringify(elements, null, 2));

    // Process materials from layers
    const materialPromises = elements.flatMap((element: IFCElement) => {
      const layers = element.materialLayers?.layers;
      if (!layers || !Array.isArray(layers)) {
        return [];
      }

      // Extract unique materials from layers
      const uniqueMaterials = new Map();
      layers.forEach((layer) => {
        if (layer.materialName) {
          uniqueMaterials.set(layer.materialName, {
            name: layer.materialName,
            category: element.materialLayers?.layerSetName,
            // Sum up volumes for same materials
            volume:
              (uniqueMaterials.get(layer.materialName)?.volume || 0) +
              (layer.thickness || 0),
          });
        }
      });

      // Create/update materials
      return Array.from(uniqueMaterials.values()).map(async (material) => {
        // First find or create the material
        const savedMaterial = await Material.findOneAndUpdate(
          { name: material.name },
          {
            name: material.name,
            category: material.category,
          },
          {
            upsert: true,
            new: true,
          }
        );

        // Then create/update the material usage for this project
        await MaterialUsage.findOneAndUpdate(
          {
            materialId: savedMaterial._id,
            projectId: projectId,
          },
          {
            materialId: savedMaterial._id,
            projectId: projectId,
            volume: material.volume,
          },
          {
            upsert: true,
            new: true,
          }
        );

        return savedMaterial;
      });
    });

    const savedMaterials = (await Promise.all(materialPromises)).filter(
      Boolean
    );
    const materialNameToId = new Map(
      savedMaterials.map((m: SavedMaterial) => [m.name, m._id])
    );

    // Save elements with material references
    const elementPromises = elements.map(async (element: IFCElement) => {
      // Get material IDs from layers
      const materialIds =
        element.materialLayers?.layers
          ?.filter(
            (layer): layer is MaterialLayer & { materialName: string } =>
              layer.materialName !== undefined
          )
          .map((layer) => materialNameToId.get(layer.materialName))
          .filter(Boolean) || [];

      const elementData = {
        guid: element.globalId,
        name: element.name || "",
        type: element.type,
        volume: element.netVolume,
        buildingStorey: element.spatialContainer,
        projectId: projectId,
        uploadId: upload._id,
        materials: materialIds,
        materialLayers:
          element.materialLayers && element.materialLayers.layers
            ? {
                layerSetName: element.materialLayers.layerSetName,
                layers: element.materialLayers.layers.map(
                  (layer: MaterialLayer) => ({
                    layerId: layer.layerId,
                    layerName: layer.layerName,
                    thickness: layer.thickness,
                    materialName: layer.materialName,
                  })
                ),
              }
            : undefined,
      };

      try {
        return await Element.findOneAndUpdate(
          {
            guid: element.globalId,
            projectId: projectId,
          },
          elementData,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
      } catch (error) {
        console.error(`Failed to save element ${element.name}:`, error);
        return null;
      }
    });

    const savedElements = (await Promise.all(elementPromises)).filter(Boolean);

    // Update upload status
    await Upload.findByIdAndUpdate(uploadId, {
      status: "Completed",
      elementCount: totalElementCount,
    });

    return NextResponse.json({
      success: true,
      elementCount: totalElementCount,
      materialCount: savedMaterials.length,
    });
  } catch (error) {
    console.error("Failed to process IFC:", error);

    if (typeof uploadId !== "undefined") {
      await Upload.findByIdAndUpdate(uploadId, {
        status: "Failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return NextResponse.json(
      { error: "Failed to process IFC file" },
      { status: 500 }
    );
  }
}
