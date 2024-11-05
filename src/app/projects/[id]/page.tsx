"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/upload-modal";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  uploads: Array<{
    id: string;
    filename: string;
    status: string;
    elementCount: number;
    createdAt: string;
  }>;
  _count: {
    elements: number;
  };
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch project");
        }
        const data = await response.json();
        setProject(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <Button onClick={() => setIsUploadModalOpen(true)}>Upload IFC</Button>
      </div>

      {project.description && (
        <p className="text-muted-foreground mb-6">{project.description}</p>
      )}

      <UploadModal
        projectId={projectId}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={() => {
          window.location.reload();
        }}
      />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Uploads ({project.uploads.length})
        </h2>
        {project.uploads.map((upload) => (
          <div
            key={upload.id}
            className="border rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{upload.filename}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(upload.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {upload.elementCount} elements
              </p>
              <p
                className={`text-sm ${
                  upload.status === "Completed"
                    ? "text-green-600"
                    : upload.status === "Failed"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {upload.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
