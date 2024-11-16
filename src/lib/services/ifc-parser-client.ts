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
    console.log("Creating upload record...");
    const uploadResponse = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: file.name }),
    });

    const responseData = await uploadResponse.json();
    if (!uploadResponse.ok || !responseData.uploadId) {
      console.error("Failed to create upload record:", responseData);
      throw new Error(responseData.error || "Failed to create upload record");
    }
    console.log("Upload record created successfully", { uploadId: responseData.uploadId });

    // Read file content
    console.log("Reading file contents...");
    const content = await file.text();

    // Send content to server for processing
    console.log("Sending content to server for processing...");
    const processResponse = await fetch(`/api/projects/${projectId}/upload/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadId: responseData.uploadId,
        content
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.json();
      console.error("Failed to process upload:", error);
      throw new Error(error.error || "Failed to process upload");
    }

    const processResult = await processResponse.json();
    console.log("[DEBUG] Process result:", processResult);

    const result = {
      uploadId: responseData.uploadId,
      elementCount: processResult.elementCount || 0,
      materialCount: processResult.materialCount || 0,
      unmatchedMaterialCount: processResult.unmatchedMaterialCount || 0,
      shouldRedirectToLibrary: processResult.unmatchedMaterialCount > 0,
    };

    console.log("[DEBUG] Returning result:", result);
    return result;

  } catch (error) {
    console.error("Ifc parsing failed:", error);
    throw error;
  }
}
