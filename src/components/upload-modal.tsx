"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadCloud } from "lucide-react";
import { ReloadIcon } from "@radix-ui/react-icons";
import { parseIFCFile } from "@/lib/services/ifc-parser-client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

interface UploadModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

export function UploadModal({
  projectId,
  open,
  onOpenChange,
  onUploadComplete,
}: UploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        setIsUploading(true);
        const file = acceptedFiles[0];
        logger.debug('Starting file upload');
        const results = await parseIFCFile(file, projectId);
        logger.debug('Upload results', {
          elementCount: results.elementCount,
          materialCount: results.materialCount,
          unmatchedMaterialCount: results.unmatchedMaterialCount,
          shouldRedirectToLibrary: results.shouldRedirectToLibrary
        });

        toast({
          title: "Upload Successful",
          description: results.unmatchedMaterialCount > 0
            ? `Successfully processed ${results.elementCount} elements. Found ${results.unmatchedMaterialCount} materials that need matching.`
            : `Successfully processed ${results.elementCount} elements`,
        });

        // Close modal immediately after successful upload
        onOpenChange(false);

        // If we have unmatched materials, redirect to the materials library
        logger.debug('Should redirect', { shouldRedirect: results.shouldRedirectToLibrary });
        if (results.shouldRedirectToLibrary) {
          logger.debug('Redirecting to materials library');
          router.push(`/materials-library?projectId=${projectId}`);
          router.refresh();
        } else {
          logger.debug('No redirection needed, refreshing page');
          router.refresh();
          onUploadComplete?.();
        }
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to upload file",
          variant: "destructive",
        });
        onOpenChange(false);
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, onUploadComplete, onOpenChange, router, toast]
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
          <div className="flex flex-col items-center justify-center py-8">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              Processing Ifc file...
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
