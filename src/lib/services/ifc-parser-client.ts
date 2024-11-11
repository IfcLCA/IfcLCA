import { IFCParser } from "./ifc-parser";
import { IFCParseResult } from "../types/ifc";

export async function parseIFCFile(
  file: File,
  projectId: string
): Promise<IFCParseResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: formData,
    });

    const responseData = await uploadResponse.json();

    if (!uploadResponse.ok || !responseData.uploadId) {
      throw new Error(responseData.error || "Failed to create upload record");
    }

    const content = await file.text();
    const parser = new IFCParser();
    const parseResult = await parser.parseContent(content);

    const elementsResponse = await fetch(
      `/api/projects/${projectId}/upload/elements`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          elements: parseResult,
          uploadId: responseData.uploadId,
        }),
      }
    );

    if (!elementsResponse.ok) {
      const error = await elementsResponse.json();
      throw new Error(error.message || "Failed to save elements");
    }

    return {
      uploadId: responseData.uploadId,
      elements: parseResult,
      elementCount: parseResult.length,
    };
  } catch (error) {
    console.error("IFC parsing failed:", error);
    throw error;
  }
}
