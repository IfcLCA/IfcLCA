"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  LcaExportPayload,
  downloadFile,
  exportIfcWithLcaService,
} from "@/lib/services/ifc-export-service";
import { ReloadIcon } from "@radix-ui/react-icons";
import { FileUp, Info, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

interface IfcExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  lcaIndicators: LcaExportPayload;
}

function buildFileName(originalName: string): string {
  const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");
  return `${nameWithoutExtension || "export"}_IfcLCA.ifc`;
}

export function IfcExportModal({
  open,
  onOpenChange,
  projectName,
  lcaIndicators,
}: IfcExportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const elementCount = useMemo(
    () => Object.keys(lcaIndicators || {}).length,
    [lcaIndicators]
  );
  const canExport = elementCount > 0;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length || !canExport) {
        if (!canExport) {
          toast({
            title: "Nothing to export",
            description:
              "No project elements with LCA indicators are available for export.",
            variant: "destructive",
          });
        }
        return;
      }

      try {
        setIsProcessing(true);
        let successCount = 0;
        const failures: string[] = [];

        for (const file of acceptedFiles) {
          try {
            const buffer = await file.arrayBuffer();
            const result = await exportIfcWithLcaService(buffer, lcaIndicators);

            if (!result?.ifcData) {
              failures.push(file.name);
              continue;
            }

            downloadFile(
              result.ifcData,
              buildFileName(file.name),
              "application/ifc"
            );
            successCount += 1;

            if (result.missingGuids?.length) {
              console.warn(
                "Some GUIDs were not found in the IFC:",
                result.missingGuids
              );
            }
          } catch (error) {
            console.error("Failed to export IFC", error);
            failures.push(file.name);
          }
        }

        if (successCount) {
          toast({
            title: "IFC export ready",
            description: successCount === 1
              ? "The exported IFC file has been downloaded."
              : `${successCount} IFC files have been downloaded.`,
          });
        }

        if (failures.length) {
          toast({
            title: "Export failed",
            description: `Could not export ${failures.length} file(s): ${failures.join(", ")}`,
            variant: "destructive",
          });
        }

        if (!failures.length) {
          onOpenChange(false);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [canExport, lcaIndicators, onOpenChange, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/ifc": [".ifc"],
      "application/x-step": [".ifc"],
    },
    disabled: isProcessing || !canExport,
    multiple: true,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export LCA indicators to IFC</DialogTitle>
          <DialogDescription>
            Select one or more IFC files that belong to <strong>{projectName}</strong>
            . The exported file(s) will contain a <code>CPset_IfcLCA</code>
            property set populated with GWP, PENRE, and UBP results for every
            matching element GUID.
          </DialogDescription>
        </DialogHeader>

        {!canExport ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <Info className="mb-2 h-6 w-6 text-muted-foreground" />
            <p>
              Upload an IFC and match its materials before exporting. No
              element-level indicators are available yet.
            </p>
          </div>
        ) : isProcessing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ReloadIcon className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Installing IfcOpenShell and preparing your IFC file...
            </p>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-10 text-center transition-colors ${
              isDragActive
                ? "border-primary bg-primary/10"
                : "border-border bg-muted/40"
            }`}
          >
            <input {...getInputProps()} />
            <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">
              {isDragActive
                ? "Drop the IFC files here"
                : "Drag & drop IFC files, or click to select"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {elementCount} element{elementCount === 1 ? "" : "s"} will receive
              LCA indicators inside the <code>CPset_IfcLCA</code> property set.
            </p>
          </div>
        )}

        {canExport && !isProcessing && (
          <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/40 p-4 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">What gets exported?</p>
              <p>
                For each matching GUID we store <code>GWP_fossil</code>,
                <code>non-renewableprimaryresourceswithenergycontent-tot</code>,
                <code>non-renewableprimaryresourceswithoutenergycontent-tot</code>,
                and <code>UBP</code> within <code>CPset_IfcLCA</code>.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
