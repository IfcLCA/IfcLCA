"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadCloud, CheckIcon } from "lucide-react";
import { parseIFCFile } from "@/lib/services/ifc-parser-client";
import { useToast } from "@/hooks/use-toast";
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
  const [uploadResult, setUploadResult] = useState<{
    count: number;
    show: boolean;
  } | null>(null);
  const { toast } = useToast();

  // Reset upload result when modal closes
  useEffect(() => {
    if (!open) {
      setUploadResult(null);
    }
  }, [open]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        setIsUploading(true);
        const file = acceptedFiles[0];
        const result = await parseIFCFile(file, projectId);

        // Set upload result instead of showing toast
        setUploadResult({ count: result.elementCount || 0, show: true });

        // Hide the success message after 5 seconds and close modal
        setTimeout(() => {
          setUploadResult((prev) => (prev ? { ...prev, show: false } : null));
          onOpenChange(false);
          onSuccess?.({ id: projectId });
        }, 5000);
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
    [projectId, onSuccess, onOpenChange, toast]
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
        {uploadResult?.show ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Upload Successful</h3>
              <p className="text-muted-foreground">
                Successfully processed {uploadResult.count.toLocaleString()}{" "}
                building elements
              </p>
            </div>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
