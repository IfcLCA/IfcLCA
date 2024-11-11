import { IFCParser } from "./ifc-parser";
import { IFCParseResult } from "../types/ifc";
import { saveElements } from "@/app/actions/save-elements";

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

    const result = await saveElements(projectId, {
      elements: parseResult,
      uploadId: responseData.uploadId,
    });

    return {
      uploadId: responseData.uploadId,
      elements: parseResult,
      elementCount: result.elementCount,
    };
  } catch (error) {
    console.error("IFC parsing failed:", error);
    throw error;
  }
}
