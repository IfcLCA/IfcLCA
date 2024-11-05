"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/upload-modal";
import { ProjectOverview } from "@/components/project-overview";

export default function ProjectsPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div>
      <ProjectOverview />
    </div>
  );
}
