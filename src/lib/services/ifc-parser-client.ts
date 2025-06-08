import { logger } from "@/lib/logger";
import {
  parseIfcWithWasm,
  IFCParseResult as WASMParseResult,
  APIElement,
} from "./ifc-wasm-parser";

export interface IFCParseResult {
  uploadId: string;
  elementCount: number;
  materialCount: number;
  unmatchedMaterialCount: number;
  shouldRedirectToLibrary: boolean;
}

export async function parseIFCFile(
  file: File,
  projectId: string,
): Promise<IFCParseResult> {
  let responseData;
  try {
    logger.debug("Starting Ifc parsing process", {
      filename: file.name,
      size: file.size,
      type: file.type,
      projectId,
    });

    // Create upload record
    logger.debug("Creating upload record...");
    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });

    logger.debug("Upload response status:", uploadResponse.status);
    responseData = await uploadResponse.json();
    logger.debug("Upload response data:", responseData);

    if (!uploadResponse.ok || !responseData.uploadId) {
      throw new Error(responseData.error || "Failed to create upload record");
    }

    // Parse the Ifc file locally using IfcOpenShell WASM
    logger.debug("Parsing Ifc file locally using IfcOpenShell WASM");
    const parseResult: WASMParseResult = await parseIfcWithWasm(file);
    const elements = parseResult.elements;

    // Debug: Log the parse result structure
    logger.debug("WASM Parse Result", {
      totalElements: parseResult.total_elements,
      totalMaterialsFound: parseResult.total_materials_found,
      totalMaterialVolumesFound: parseResult.total_material_volumes_found,
      debugInfo: parseResult.debug,
    });

    // Debug: Log the structure of the first few elements
    logger.debug("Parsed elements structure", {
      elementCount: elements.length,
      firstElement: elements[0]
        ? {
            id: elements[0].id,
            type: elements[0].type,
            object_type: elements[0].object_type,
            volume: elements[0].volume,
            materials: elements[0].materials,
            material_volumes: elements[0].material_volumes,
            hasDirectMaterials: !!elements[0].materials,
            hasMaterialVolumes: !!elements[0].material_volumes,
            materialVolumesKeys: elements[0].material_volumes
              ? Object.keys(elements[0].material_volumes)
              : [],
          }
        : null,
      secondElement: elements[1]
        ? {
            id: elements[1].id,
            type: elements[1].type,
            materials: elements[1].materials,
            material_volumes: elements[1].material_volumes,
            hasDirectMaterials: !!elements[1].materials,
            hasMaterialVolumes: !!elements[1].material_volumes,
            materialVolumesKeys: elements[1].material_volumes
              ? Object.keys(elements[1].material_volumes)
              : [],
          }
        : null,
    });

    const materials = new Set<string>();
    let directMaterialCount = 0;
    let layerMaterialCount = 0;

    elements.forEach((element: APIElement, index: number) => {
      // Extract materials from direct materials array
      if (element.materials) {
        element.materials.forEach((m: string) => {
          materials.add(m);
          directMaterialCount++;
        });
      }
      // Also extract materials from material_volumes (material layers)
      if (element.material_volumes) {
        Object.keys(element.material_volumes).forEach(
          (materialName: string) => {
            materials.add(materialName);
            layerMaterialCount++;
          },
        );
      }

      // Debug each element
      if (index < 3) {
        // Log first 3 elements
        logger.debug(`Element ${index} material analysis`, {
          elementId: element.id,
          type: element.type,
          directMaterials: element.materials || [],
          materialVolumes: element.material_volumes || {},
          foundMaterials: element.materials?.length || 0,
          foundMaterialVolumes: element.material_volumes
            ? Object.keys(element.material_volumes).length
            : 0,
        });
      }
    });

    logger.debug("Material extraction summary", {
      totalUniqueMaterials: materials.size,
      directMaterialReferences: directMaterialCount,
      layerMaterialReferences: layerMaterialCount,
      materials: Array.from(materials),
    });

    // Process materials
    const materialNames = Array.from(materials);
    const checkMatchesResponse = await fetch("/api/materials/check-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialNames, projectId }),
    });

    if (!checkMatchesResponse.ok) {
      throw new Error("Failed to check material matches");
    }

    const matchesData = await checkMatchesResponse.json();
    const unmatchedMaterialCount = matchesData.unmatchedMaterials.length;

    // Log initial file info
    console.debug("📁 Starting Ifc parse for file:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // After parsing elements from stream
    console.debug("📊 Parsed elements from Ifc:", {
      count: elements.length,
      firstElement: elements[0],
      lastElement: elements[elements.length - 1],
    });

    // After processing materials
    console.debug("🧱 Extracted materials:", {
      count: materials.size,
      materialsList: Array.from(materials),
    });

    // Before sending to process endpoint
    console.debug("📤 Element with properties:", {
      element: elements[0],
      mappedElement: {
        globalId: elements[0].id,
        type: elements[0].type,
        name: elements[0].object_type,
        netVolume: elements[0].volume || 0,
        properties: {
          loadBearing: elements[0].properties.loadBearing || false,
          isExternal: elements[0].properties.isExternal || false,
        },
      },
    });

    // Process elements
    const processResponse = await fetch(
      `/api/projects/${projectId}/upload/process`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: responseData.uploadId,
          elements: elements.map((element: APIElement) => ({
            globalId: element.id,
            type: element.type,
            name: element.object_type,
            classification: element.classification,
            volume: element.volume || 0,
            properties: {
              loadBearing: element.properties.loadBearing || false,
              isExternal: element.properties.isExternal || false,
            },
            materials:
              element.materials?.map((materialName: string) => {
                const materialVolumeData =
                  element.material_volumes?.[materialName];
                const materialVolume =
                  materialVolumeData?.volume ||
                  (element.volume || 0) / (element.materials?.length || 1);

                return {
                  name: materialName,
                  volume: materialVolume,
                };
              }) || [],
            materialLayers: element.material_volumes
              ? {
                  layerSetName: `${element.type}_Layers`,
                  layers: Object.entries(element.material_volumes).map(
                    ([name, data]) => ({
                      materialName: name,
                      volume: data.volume,
                      fraction: data.fraction,
                    }),
                  ),
                }
              : undefined,
          })),
          isLastChunk: true,
        }),
      },
    );

    if (!processResponse.ok) {
      throw new Error("Failed to process elements");
    }

    return {
      uploadId: responseData.uploadId,
      elementCount: elements.length,
      materialCount: materials.size,
      unmatchedMaterialCount,
      shouldRedirectToLibrary: unmatchedMaterialCount > 0,
    };
  } catch (error) {
    logger.error("Error in parseIFCFile", { error });
    throw error;
  }
}
