"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  downloadFile,
  exportIfcWithLcaResultsService,
  type ElementLcaExportMap,
} from "@/lib/services/ifc-export-service";
import { ReloadIcon } from "@radix-ui/react-icons";
import { UploadCloud } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ExportIfcModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  elementResults: ElementLcaExportMap;
  elementNames: Record<string, string>;
}

export function ExportIfcModal({
  open,
  onOpenChange,
  projectName,
  elementResults,
  elementNames,
}: ExportIfcModalProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const hasResults = useMemo(
    () => Object.keys(elementResults || {}).length > 0,
    [elementResults]
  );

  const handleExport = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length || !hasResults) {
        return;
      }

      try {
        setIsExporting(true);
        for (const file of acceptedFiles) {
          setCurrentFileName(file.name);
          const buffer = await file.arrayBuffer();
          const result = await exportIfcWithLcaResultsService(
            buffer,
            elementResults
          );

          if (!result) {
            toast({
              title: "Export failed",
              description:
                "We couldn't embed the LCA results into this IFC file. Please try again.",
              variant: "destructive",
            });
            continue;
          }

          const fileName = file.name.replace(/\.ifc$/i, "");
          const outputName = `${fileName || "IfcLCA"}_with-results.ifc`;
          downloadFile(result.ifcData, outputName, "application/ifc");

          const missingCount = result.missingGuids.length;
          const missingExamples = result.missingGuids
            .slice(0, 3)
            .map((guid) => elementNames[guid] || guid)
            .join(", ");

          toast({
            title: "IFC exported",
            description:
              missingCount > 0
                ? `Added results to ${result.updatedCount} elements. Missing ${missingCount} GUIDs: ${missingExamples}${
                    result.missingGuids.length > 3 ? ", ..." : ""
                  }`
                : `Successfully embedded results for ${result.updatedCount} elements.`,
          });
        }
      } catch (error) {
        console.error("Failed to export IFC:", error);
        toast({
          title: "Export error",
          description:
            "Something went wrong while exporting the IFC file. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
        setCurrentFileName(null);
        onOpenChange(false);
      }
    },
    [elementNames, elementResults, hasResults, onOpenChange, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleExport,
    accept: {
      "application/ifc": [".ifc"],
      "application/x-step": [".ifc"],
    },
    multiple: true,
    disabled: isExporting || !hasResults,
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isExporting && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export IFC with LCA results</DialogTitle>
          <DialogDescription>
            {hasResults
              ? `Upload one or more IFC files from ${projectName} to embed calculated GWP, PENRE, and UBP values.`
              : "Add IFC data to your project before exporting results."}
          </DialogDescription>
        </DialogHeader>
        {isExporting ? (
          <div className="flex flex-col items-center justify-center py-8">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              {currentFileName
                ? `Embedding results into ${currentFileName}...`
                : "Processing IFC file..."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {Object.keys(elementResults).length} elements ready for export
              </p>
              <p>
                We&apos;ll match IFC elements by GUID and store the indicators in the
                custom property set <span className="font-mono">CPset_IfcLCA</span>.
              </p>
            </div>
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                ${isDragActive ? "border-primary bg-primary/10" : "border-border"}
                ${!hasResults ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop the IFC files here"
                  : "Drag and drop IFC files, or click to select"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We recommend using the same files that were used for parsing so GUIDs
                match.
              </p>
              <Button className="mt-4" disabled={!hasResults} type="button">
                Select IFC files
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
