"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload } from "lucide-react";

interface UploadModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
  trigger: React.ReactNode;
}

export function UploadModal({
  projectId,
  open,
  onOpenChange,
  onUploadComplete,
  trigger,
}: UploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      if (onUploadComplete) {
        onUploadComplete();
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "application/ifc": [".ifc"],
      "application/step": [".stp", ".step"],
      "text/plain": [".ifc"], // Some systems identify IFC as text
    },
    maxFiles: 1,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload IFC File</DialogTitle>
        </DialogHeader>
        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer"
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Processing IFC file...</p>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto h-8 w-8 mb-4" />
              <p>Drag and drop an IFC file here, or click to select</p>
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
