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
import { parseIFCFile } from "@/lib/services/ifc-parser-client";
import { useToast } from "@/hooks/use-toast";
interface UploadModalProps {
  projectId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        setIsUploading(true);
        const file = acceptedFiles[0];
        const result = await parseIFCFile(file, projectId);

        // Close modal first
        onOpenChange?.(false);

        // Show success toast
        toast({
          title: "Success",
          description: `Uploaded ${result.elementCount} elements`,
        });

        // Finally, refresh the data
        await onUploadComplete?.();
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to upload file",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, onUploadComplete, onOpenChange, toast]
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
          <DialogTitle>Upload IFC File</DialogTitle>
        </DialogHeader>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            ${isDragActive ? "border-primary bg-primary/10" : "border-border"}
            ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isDragActive
              ? "Drop the file here"
              : isUploading
              ? "Uploading..."
              : "Drag and drop an IFC file, or click to select"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
