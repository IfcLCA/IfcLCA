import { IFCParserAdapter } from './IFCParserAdapter';
import { logger } from '@/lib/logger';

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

    // Pre-process materials before chunking to avoid redundant processing
    const materialsMap = new Map<string, boolean>();
    let unmatchedMaterialCount = 0;

    parsedElements.forEach(element => {
      if (element.materialLayers?.layers) {
        element.materialLayers.layers.forEach(layer => {
          if (layer.materialName) {
            materialsMap.set(layer.materialName, true);
          } else {
            unmatchedMaterialCount++;
          }
        });
      }
    });

    // Optimize chunk size based on element count
    const totalElements = parsedElements.length;
    const chunkSize = Math.min(
      Math.max(Math.floor(totalElements / 20), 500), // At least 500, targeting 20 chunks
      2000 // But no more than 2000 to avoid memory issues
    );

    // Create chunks more efficiently
    const chunks = Array.from({ length: Math.ceil(totalElements / chunkSize) }, (_, i) =>
      parsedElements.slice(i * chunkSize, (i + 1) * chunkSize)
    );

    logger.debug('Optimized chunking', {
      totalElements,
      chunkSize,
      totalChunks: chunks.length,
      lastChunkSize: chunks[chunks.length - 1]?.length
    });

    let totalProcessed = 0;
    const totalChunks = chunks.length;
    const uploadPromises: Promise<Response>[] = [];
    const maxConcurrentUploads = 3; // Limit concurrent uploads

    // Process chunks with controlled concurrency
    for (let i = 0; i < chunks.length; i += maxConcurrentUploads) {
      const chunkGroup = chunks.slice(i, i + maxConcurrentUploads);
      const groupPromises = chunkGroup.map((chunk, groupIndex) => {
        const currentChunkIndex = i + groupIndex;

        return fetch(`/api/projects/${projectId}/upload/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: responseData.uploadId,
            elements: chunk,
            isLastChunk: currentChunkIndex === chunks.length - 1
          }),
        }).then(async response => {
          if (!response.ok) {
            throw new Error(`Failed to process chunk ${currentChunkIndex + 1}`);
          }
          const result = await response.json();
          totalProcessed += chunk.length;
          logger.debug(`Chunk ${currentChunkIndex + 1}/${chunks.length} processed`, {
            success: true,
            elementCount: result.elementCount
          });
          return response;
        });
      });

      // Wait for current group to complete before processing next group
      try {
        await Promise.all(groupPromises);
      } catch (error) {
        logger.error('Error in chunk group', { error });
        throw error;
      }
    }

    logger.debug('Processing completed', {
      totalProcessed,
      unmatchedMaterialCount,
      totalMaterials: materialsMap.size
    });

    return {
      uploadId: responseData.uploadId,
      elementCount: totalProcessed,
      materialCount: materialsMap.size,
      unmatchedMaterialCount,
      shouldRedirectToLibrary: materialsMap.size > 0
    };
  } catch (error) {
    logger.error('Error in parseIFCFile', { error });
    throw error;
  }
}