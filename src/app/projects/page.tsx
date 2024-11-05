"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/upload-modal";
import { ProjectOverview } from "@/components/project-overview";

export default function ProjectsPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsUploadModalOpen(true)}>Upload IFC</Button>

      <UploadModal
        projectId="your-project-id"
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={() => {
          // Refresh project data or handle completion
        }}
      />

      <ProjectOverview />
    </div>
  );
}
