import { IFCParser } from "./ifc-parser";
import { IFCParseResult } from "../types/ifc";

export async function parseIFCFile(
  file: File,
  projectId: string
): Promise<IFCParseResult> {
  try {
    console.log(`Starting Ifc file parsing for project ${projectId}`, {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Create upload record
    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });

    const responseData = await uploadResponse.json();
    if (!uploadResponse.ok || !responseData.uploadId) {
      throw new Error(responseData.error || "Failed to create upload record");
    }

    // Parse file client-side
    const content = await file.text();
    const parser = new IFCParser();
    const parsedElements = await parser.parseContent(content);

    // Send parsed results in chunks to avoid payload size limits
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < parsedElements.length; i += chunkSize) {
      chunks.push(parsedElements.slice(i, i + chunkSize));
    }

    let totalProcessed = 0;
    for (const chunk of chunks) {
      const processResponse = await fetch(
        `/api/projects/${projectId}/upload/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: responseData.uploadId,
            elements: chunk,
            isLastChunk: chunk === chunks[chunks.length - 1],
          }),
        }
      );

      if (!processResponse.ok) {
        throw new Error("Failed to process elements chunk");
      }

      const chunkResult = await processResponse.json();
      totalProcessed += chunkResult.elementCount || 0;
    }

    return {
      uploadId: responseData.uploadId,
      elementCount: totalProcessed,
      materialCount: parsedElements.length,
      shouldRedirectToLibrary: false,
    };
  } catch (error) {
    console.error("Ifc parsing failed:", error);
    throw error;
  }
}
