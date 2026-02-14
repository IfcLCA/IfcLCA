"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { useAppStore, viewerRefs } from "@/lib/store/app-store";

interface UploadZoneProps {
  projectId: string;
}

/**
 * IFC file upload zone.
 *
 * When a file is dropped:
 * 1. Initialize renderer (if not already done)
 * 2. Stream geometry → meshes appear in viewer immediately
 * 3. Parse data model → extract elements, materials, properties
 * 4. Bridge to app types → populate store
 * 5. Send data to server for persistence
 */
export function UploadZone({ projectId }: UploadZoneProps) {
  const {
    setParseResult,
    setModelLoading,
    setModelError,
    setLoadProgress,
    modelLoading,
  } = useAppStore();
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setModelLoading(true);
      setModelError(null);

      try {
        console.log("[UploadZone] File dropped:", file.name, `(${(file.size / 1024 / 1024).toFixed(1)} MB)`);

        // Dynamic import to keep ifc-lite out of the initial bundle
        console.log("[UploadZone] Importing loader...");
        const { loadIfcFile } = await import("@/lib/ifc/loader");

        // Read file into buffer
        console.log("[UploadZone] Reading file into buffer...");
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Wait for the viewer component to initialize the WebGPU renderer.
        // viewerRefs.rendererReady resolves when the renderer calls rendererReadyResolve().
        if (!viewerRefs.renderer) {
          console.log("[UploadZone] Renderer not ready, waiting (up to 15s)...");
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("WebGPU renderer timed out after 15s. Check browser console for [IfcViewer] logs.")),
              15_000
            )
          );
          await Promise.race([viewerRefs.rendererReady, timeout]);
          console.log("[UploadZone] Renderer ready signal received!");
        } else {
          console.log("[UploadZone] Renderer already available");
        }

        if (!viewerRefs.renderer) {
          throw new Error(
            "WebGPU renderer not available after wait. Your browser may not support WebGPU."
          );
        }

        // Load IFC: stream geometry → parse data → bridge to app types
        console.log("[UploadZone] Starting IFC load pipeline...");
        const result = await loadIfcFile(
          buffer,
          viewerRefs.renderer as any,
          (progress) => {
            setLoadProgress(progress);
          }
        );
        console.log("[UploadZone] IFC loaded:", result.parseResult.stats);

        // Store native refs
        viewerRefs.dataStore = result.dataStore;
        viewerRefs.coordinateInfo = result.coordinateInfo;

        // Build expressId ↔ GUID mappings
        const dataStore = result.dataStore as any;
        if (dataStore?.entities) {
          const { extractEntityAttributesOnDemand } = await import(
            "@ifc-lite/parser"
          );
          const entities = dataStore.entities;
          for (let i = 0; i < entities.expressId.length; i++) {
            const expressId = entities.expressId[i];
            const attrs = extractEntityAttributesOnDemand(dataStore, expressId);
            if (attrs.globalId) {
              viewerRefs.expressIdToGuid.set(expressId, attrs.globalId);
              viewerRefs.guidToExpressId.set(attrs.globalId, expressId);
            }
          }
        }

        // Populate store (triggers UI update)
        setParseResult(result.parseResult);

        // Send to server for persistence (non-blocking)
        persistToServer(projectId, file, result.parseResult).catch((err) =>
          console.error("Failed to persist upload:", err)
        );
      } catch (err) {
        console.error("IFC loading failed:", err);
        setModelError(
          err instanceof Error ? err.message : "Failed to parse IFC file"
        );
      }
    },
    [projectId, setParseResult, setModelLoading, setModelError, setLoadProgress]
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
          <p className="text-lg font-medium">Loading {fileName}...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Streaming geometry and extracting materials
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
            IFC2x3, IFC4, IFC4x3 supported — parsed via WASM in your browser
          </p>
        </>
      )}
    </div>
  );
}

/** Send parse results to server for DB persistence */
async function persistToServer(
  projectId: string,
  file: File,
  parseResult: import("@/types/ifc").IFCParseResult
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("parseResult", JSON.stringify(parseResult));

  const res = await fetch(`/api/projects/${projectId}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}
