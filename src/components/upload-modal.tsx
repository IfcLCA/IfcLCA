"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { parseIFCFile } from "@/lib/services/ifc-parser-client";
import { ReloadIcon } from "@radix-ui/react-icons";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";

interface UploadModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (upload: { id: string }) => void;
  onProgress?: (progress: number) => void;
}

export function UploadModal({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  onProgress,
}: UploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

  const uploadMessages = [
    "Crunching your IFC data...",
    "Counting walls and windows...",
    "Matching materials with our library...",
    "Consulting the BIM wizards...",
    "Summoning digital building blocks...",
    "Untangling IFC spaghetti...",
    "Double-checking door swings...",
    "Juggling geometries...",
    "Compiling building jokes...",
    "Almost done with the magic...",
  ];

  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % uploadMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isUploading, uploadMessages.length]);


  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        setIsUploading(true);
        const file = acceptedFiles[0];
        logger.debug("Starting file upload");

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Upload timed out after 50 seconds")),
            50000
          );
        });

        const uploadPromise = parseIFCFile(file, projectId);
        const results = (await Promise.race([
          uploadPromise,
          timeoutPromise,
        ])) as any;

        logger.debug("Upload results", {
          elementCount: results.elementCount,
          materialCount: results.materialCount,
          unmatchedMaterialCount: results.unmatchedMaterialCount,
          shouldRedirectToLibrary: results.shouldRedirectToLibrary,
        });

        toast({
          title: "Upload Successful",
          description: (
            <div className="space-y-1">
              <p>
                Processed {results.elementCount} elements across{' '}
                {Object.keys(results.classCounts || {}).length} classes.
              </p>
              <p>Total unique materials: {results.materialCount}.</p>
              {results.matchedMaterials.length > 0 && (
                <p>
                  Auto-matched {results.matchedMaterials.length} materials:{' '}
                  {results.matchedMaterials.slice(0, 5).join(', ')}
                  {results.matchedMaterials.length > 5 ? '...' : ''}
                </p>
              )}
              {results.unmatchedMaterialCount > 0 && (
                <p>{results.unmatchedMaterialCount} materials need matching.</p>
              )}
              {Object.keys(results.classCounts || {}).length > 0 && (
                <div className="pt-2">
                  <p className="font-semibold">Element counts:</p>
                  <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                    {Object.entries(results.classCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <li key={type}>
                          {type}: {count}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        });

        onOpenChange(false);

        if (results.shouldRedirectToLibrary) {
          logger.debug("Redirecting to materials library");
          router.push(`/materials-library?projectId=${projectId}`);
          router.refresh();
        } else {
          logger.debug("No redirection needed, refreshing page");
          router.refresh();
          onSuccess?.({ id: results.uploadId });
        }
      } catch (error) {
        logger.error("Upload failed:", error);
        toast({
          title: "Upload Failed",
          description:
            error instanceof Error &&
            error.message === "Upload timed out after 50 seconds"
              ? "The upload timed out. Please try again with a smaller file."
              : error instanceof Error
              ? `Error: ${error.message}`
              : "There was an error processing your file. Please try again or contact support if the issue persists.",
          variant: "destructive",
        });
        onOpenChange(false);
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, onSuccess, onOpenChange, router, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/ifc": [".ifc"],
      "application/x-step": [".ifc"],
    },
    disabled: isUploading,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load Ifc File</DialogTitle>
        </DialogHeader>
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              {uploadMessages[messageIndex]}
            </p>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              ${isDragActive ? "border-primary bg-primary/10" : "border-border"}
            `}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isDragActive
                ? "Drop the file here"
                : "Drag and drop an Ifc file, or click to select"}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
