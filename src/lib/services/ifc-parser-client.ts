import { logger } from "@/lib/logger";
import { parseIfcWithWasm, APIElement } from "./ifc-wasm-parser";

export interface IFCParseResult {
  uploadId: string;
  elementCount: number;
  materialCount: number;
  unmatchedMaterialCount: number;
  shouldRedirectToLibrary: boolean;
}

export async function parseIFCFile(
  file: File,
  projectId: string
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
    const elements: APIElement[] = await parseIfcWithWasm(file);
    const materials = new Set<string>();
    elements.forEach((element) => {
      if (element.materials) {
        element.materials.forEach((m) => materials.add(m));
      }
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
          elements: elements.map((element) => ({
            globalId: element.id,
            type: element.type,
            name: element.object_type,
            netVolume: element.volume || 0,
            properties: {
              loadBearing: element.properties.loadBearing || false,
              isExternal: element.properties.isExternal || false,
            },
            materialLayers: element.material_volumes
              ? {
                  layerSetName: `${element.type}_Layers`,
                  layers: Object.entries(element.material_volumes).map(
                    ([name, data]) => ({
                      materialName: name,
                      volume: data.volume,
                      fraction: data.fraction,
                    })
                  ),
                }
              : undefined,
          })),
          isLastChunk: true,
        }),
      }
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
