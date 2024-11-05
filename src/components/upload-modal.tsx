"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UploadModalProps {
  projectId: string;
  onSuccess: (upload: Upload) => void;
  onProgress: (progress: number) => void;
}

interface Upload {
  id: string;
  filename: string;
  status: "Processing" | "Completed" | "Failed";
  elementCount: number;
}

export function UploadModal({
  projectId,
  onSuccess,
  onProgress,
}: UploadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<
    "selection" | "uploading" | "processing" | "complete"
  >("selection");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<{
    elementCount: number;
    validationResults: string[];
    errors: string[];
  } | null>(null);
  const [uploadResult, setUploadResult] = useState<Upload | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setStage("uploading");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 500);

        // Upload file
        const uploadResponse = await fetch(
          `/api/projects/${projectId}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const uploadData = await uploadResponse.json();
        setStage("processing");

        // Poll for processing status
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/uploads/${uploadData.id}`);
            if (!statusResponse.ok) {
              throw new Error("Failed to fetch status");
            }

            const statusData = await statusResponse.json();

            if (statusData.status === "Completed") {
              clearInterval(pollInterval);
              setProcessingStatus({
                elementCount: statusData.elementCount,
                validationResults: ["Processing completed successfully"],
                errors: [],
              });
              setStage("complete");
              setUploadResult(statusData);
              onSuccess(statusData);
            } else if (statusData.status === "Failed") {
              clearInterval(pollInterval);
              throw new Error(statusData.error || "Processing failed");
            }
          } catch (error) {
            clearInterval(pollInterval);
            setProcessingStatus({
              elementCount: 0,
              validationResults: [],
              errors: [
                error instanceof Error ? error.message : "Processing failed",
              ],
            });
          }
        }, 2000);
      } catch (error) {
        setProcessingStatus({
          elementCount: 0,
          validationResults: [],
          errors: [error instanceof Error ? error.message : "Upload failed"],
        });
        setStage("selection");
      }
    },
    [projectId, onSuccess]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/ifc": [".ifc"] },
    multiple: false,
    noClick: true, // Disable click on the entire area
  });

  const handleCancel = () => {
    setIsOpen(false);
    setStage("selection");
    setUploadProgress(0);
    setProcessingStatus(null);
    setUploadResult(null);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Upload IFC</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload IFC File</DialogTitle>
            <DialogDescription>
              Upload an IFC file to analyze your building project.
            </DialogDescription>
          </DialogHeader>
          {stage === "selection" && (
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center"
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the IFC file here ...</p>
              ) : (
                <div>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p>Drag & drop an IFC file here, or</p>
                  <button
                    onClick={open}
                    className="text-primary hover:underline focus:outline-none"
                  >
                    click to select one
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    Supported format: .ifc
                  </p>
                </div>
              )}
            </div>
          )}
          {stage === "uploading" && (
            <div className="space-y-4">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-center">{`Uploading... ${uploadProgress}%`}</p>
            </div>
          )}
          {stage === "processing" && (
            <div className="space-y-4">
              <Progress value={100} className="w-full" />
              <p className="text-center">Processing file...</p>
            </div>
          )}
          {stage === "complete" && processingStatus && uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="text-green-500" />
                <span>Upload complete</span>
              </div>
              <div>
                <p>Elements found: {processingStatus.elementCount}</p>
                {processingStatus.validationResults.map((result, index) => (
                  <p key={index} className="text-green-500">
                    {result}
                  </p>
                ))}
                {processingStatus.errors.map((error, index) => (
                  <p key={index} className="text-red-500">
                    {error}
                  </p>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            {stage === "selection" && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            {(stage === "uploading" || stage === "processing") && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel Upload
              </Button>
            )}
            {stage === "complete" && (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Close
                </Button>
                <Button onClick={() => console.log("View results")}>
                  View Results
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
