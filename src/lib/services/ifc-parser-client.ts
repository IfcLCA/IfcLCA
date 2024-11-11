import { IFCParser } from "./ifc-parser";
import { IFCParseResult } from "../types/ifc";
import { saveElements } from "@/app/actions/save-elements";

export async function parseIFCFile(
  file: File,
  projectId: string
): Promise<IFCParseResult> {
  try {
    // Create upload record with JSON
    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: file.name }),
    });

    const responseData = await uploadResponse.json();
    if (!uploadResponse.ok || !responseData.uploadId) {
      throw new Error(responseData.error || "Failed to create upload record");
    }

    // Parse file client-side
    const content = await file.text();
    const parser = new IFCParser();
    const parseResult = await parser.parseContent(content);

    // Save elements in chunks
    const chunkSize = 100;
    const chunks = [];

    for (let i = 0; i < parseResult.length; i += chunkSize) {
      chunks.push(parseResult.slice(i, i + chunkSize));
    }

    let savedCount = 0;
    for (const chunk of chunks) {
      const result = await saveElements(projectId, {
        elements: chunk,
        uploadId: responseData.uploadId,
      });
      savedCount += result.savedCount;
    }

    return {
      uploadId: responseData.uploadId,
      elements: parseResult,
      elementCount: savedCount,
    };
  } catch (error) {
    console.error("IFC parsing failed:", error);
    throw error;
  }
}
