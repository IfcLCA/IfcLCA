"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { IFCParseResult } from "@/types/ifc";

interface UploadZoneProps {
  projectId: string;
}

/**
 * IFC file upload zone.
 *
 * Handles drag-and-drop of .ifc files. The file is:
 * 1. Parsed client-side (will use ifc-lite)
 * 2. Parse results stored in Zustand
 * 3. Elements + materials sent to the server for persistence
 */
export function UploadZone({ projectId }: UploadZoneProps) {
  const { setParseResult, setModelLoading, setModelError, modelLoading } =
    useAppStore();
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setModelLoading(true);
      setModelError(null);

      try {
        // TODO: Replace with actual ifc-lite parsing
        // const buffer = await file.arrayBuffer();
        // const result = await parseIFC(buffer);

        // For now, create a mock parse result to test the flow
        const mockResult: IFCParseResult = {
          elements: [],
          materials: [],
          projectInfo: {
            name: file.name.replace(".ifc", ""),
            schema: "IFC4",
          },
          storeys: [],
          stats: {
            parseTimeMs: 0,
            elementCount: 0,
            materialCount: 0,
            fileSizeBytes: file.size,
          },
        };

        setParseResult(mockResult);

        // Send to server for persistence
        const formData = new FormData();
        formData.append("file", file);
        formData.append("parseResult", JSON.stringify(mockResult));

        await fetch(`/api/projects/${projectId}/upload`, {
          method: "POST",
          body: formData,
        });
      } catch (err) {
        setModelError(
          err instanceof Error ? err.message : "Failed to parse IFC file"
        );
      }
    },
    [projectId, setParseResult, setModelLoading, setModelError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/x-step": [".ifc"],
    },
    maxFiles: 1,
    disabled: modelLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        flex w-full max-w-lg cursor-pointer flex-col items-center justify-center
        rounded-xl border-2 border-dashed p-12 transition-colors
        ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }
        ${modelLoading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input {...getInputProps()} />

      {modelLoading ? (
        <>
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">Parsing {fileName}...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Extracting elements and materials
          </p>
        </>
      ) : isDragActive ? (
        <>
          <FileUp className="mb-4 h-12 w-12 text-primary" />
          <p className="text-lg font-medium">Drop your IFC file here</p>
        </>
      ) : (
        <>
          <Upload className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium">Upload an IFC file</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag and drop or click to browse
          </p>
          <p className="mt-4 text-xs text-muted-foreground/60">
            Supported: IFC2x3, IFC4 — parsed entirely in your browser
          </p>
        </>
      )}
    </div>
  );
}
