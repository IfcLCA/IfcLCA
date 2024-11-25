"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Project {
  id: string;
  name: string;
}

interface UploadIfcButtonProps {
  variant?: "default" | "outline" | "ghost";
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export function UploadIfcButton({
  variant = "default",
  className = "",
  showIcon = true,
  showText = true,
}: UploadIfcButtonProps) {
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const router = useRouter();

  const handleUploadClick = async () => {
    try {
      const response = await fetch("/api/projects");
      const projects = await response.json();

      if (!projects?.length) {
        return;
      }
      setProjects(projects);
      setShowProjectSelect(true);
    } catch (error) {
      console.error("Failed to check projects:", error);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        onClick={handleUploadClick}
        className={className}
      >
        {showIcon && <UploadCloud className={showText ? "mr-2 h-4 w-4" : "h-5 w-5"} />}
        {showText && "Add new Ifc"}
      </Button>

      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload the Ifc file to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectSelect(false);
                }}
              >
                {project.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedProjectId && (
        <UploadModal
          projectId={selectedProjectId}
          open={true}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setSelectedProjectId(null);
            }
          }}
          onSuccess={(upload: { id: string }) => {
            setSelectedProjectId(null);
            router.push(`/projects/${selectedProjectId}`);
          }}
          onProgress={(progress: number) => { }}
        />
      )}
    </>
  );
}
