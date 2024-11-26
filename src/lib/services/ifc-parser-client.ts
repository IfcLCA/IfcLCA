import { IFCParserAdapter } from './IFCParserAdapter';
import { logger } from '@/lib/logger';
import type { IMaterial } from '@/types/material';

export interface IFCParseResult {
  uploadId: string;
  elementCount: number;
  materialCount: number;
  unmatchedMaterialCount: number;
  shouldRedirectToLibrary: boolean;
}

export async function parseIFCFile(file: File, projectId: string): Promise<IFCParseResult> {
  let responseData;
  try {
    logger.debug('Starting Ifc parsing process', {
      filename: file.name,
      size: file.size,
      type: file.type,
      projectId
    });

    // Create upload record
    logger.debug('Creating upload record...');
    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });

    logger.debug('Upload response status:', uploadResponse.status);
    responseData = await uploadResponse.json();
    logger.debug('Upload response data:', responseData);

    if (!uploadResponse.ok || !responseData.uploadId) {
      throw new Error(responseData.error || "Failed to create upload record");
    }

    // Parse file content
    const content = await file.text();
    const parser = new IFCParserAdapter(content);
    const parsedElements = await parser.parseContent();

    logger.debug('Parsing completed', {
      elementCount: parsedElements.length,
      sampleElement: parsedElements[0]
    });

    // Pre-process materials
    const uniqueMaterialNames = Array.from(new Set(
      parsedElements.flatMap(element => {
        const materials: string[] = [];
        if (element.materialLayers) {
          element.materialLayers.layers.forEach(layer => {
            if (layer.materialName) materials.push(layer.materialName);
          });
        }
        return materials;
      })
    ));

    // Check for existing material matches
    const checkMatchesResponse = await fetch('/api/materials/check-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialNames: uniqueMaterialNames, projectId }),
    });

    if (!checkMatchesResponse.ok) {
      throw new Error('Failed to check material matches');
    }

    const matchesData = await checkMatchesResponse.json();
    const unmatchedMaterialCount = matchesData.unmatchedMaterials.length;

    // Process elements
    const processResponse = await fetch(`/api/projects/${projectId}/upload/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: responseData.uploadId,
        elements: parsedElements,
        isLastChunk: true
      })
    });

    if (!processResponse.ok) {
      throw new Error('Failed to process elements');
    }

    logger.debug('Material matching completed', {
      unmatchedCount: unmatchedMaterialCount,
      matchedCount: matchesData.matchedMaterials.length
    });

    return {
      uploadId: responseData.uploadId,
      elementCount: parsedElements.length,
      materialCount: uniqueMaterialNames.length,
      unmatchedMaterialCount,
      shouldRedirectToLibrary: unmatchedMaterialCount > 0
    };
  } catch (error) {
    logger.error('Error in parseIFCFile', { error });
    throw error;
  }
}