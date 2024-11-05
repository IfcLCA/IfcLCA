"use client"

import * as React from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, CheckCircle, AlertCircle, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UploadModalProps {
  projectId: string
  onSuccess: (upload: Upload) => void
  onProgress: (progress: number) => void
}

interface Upload {
  id: string
  filename: string
  status: "Processing" | "Completed" | "Failed"
  elementCount: number
}

export function UploadModal({ projectId, onSuccess, onProgress }: UploadModalProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [stage, setStage] = React.useState<"selection" | "uploading" | "processing" | "complete">("selection")
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [processingStatus, setProcessingStatus] = React.useState<{
    elementCount: number
    validationResults: string[]
    errors: string[]
  } | null>(null)
  const [uploadResult, setUploadResult] = React.useState<Upload | null>(null)

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setStage("uploading")
      simulateUpload(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/ifc": [".ifc"] },
    multiple: false,
    noClick: true, // Disable click on the entire area
  })

  const simulateUpload = (file: File) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploadProgress(progress)
      onProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        setStage("processing")
        simulateProcessing(file)
      }
    }, 500)
  }

  const simulateProcessing = (file: File) => {
    setTimeout(() => {
      setProcessingStatus({
        elementCount: Math.floor(Math.random() * 1000) + 100,
        validationResults: ["All elements validated successfully"],
        errors: [],
      })
      setStage("complete")
      const upload: Upload = {
        id: Math.random().toString(36).substr(2, 9),
        filename: file.name,
        status: "Completed",
        elementCount: Math.floor(Math.random() * 1000) + 100,
      }
      setUploadResult(upload)
      onSuccess(upload)
    }, 3000)
  }

  const handleCancel = () => {
    setIsOpen(false)
    setStage("selection")
    setUploadProgress(0)
    setProcessingStatus(null)
    setUploadResult(null)
  }

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
                  <p className="text-sm text-gray-500 mt-2">Supported format: .ifc</p>
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
                  <p key={index} className="text-green-500">{result}</p>
                ))}
                {processingStatus.errors.map((error, index) => (
                  <p key={index} className="text-red-500">{error}</p>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            {stage === "selection" && (
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            )}
            {(stage === "uploading" || stage === "processing") && (
              <Button variant="outline" onClick={handleCancel}>Cancel Upload</Button>
            )}
            {stage === "complete" && (
              <>
                <Button variant="outline" onClick={handleCancel}>Close</Button>
                <Button onClick={() => console.log("View results")}>View Results</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}