"use client";

import { Badge } from "./ui/badge";
import { Scale } from "lucide-react";

interface ProjectCardProps {
  project: {
    _id: string;
    emissions?: {
      gwp: number;
    };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="flex gap-2 mt-2">
      {project.emissions && (
        <Badge variant="secondary" className="gap-1">
          <Scale className="h-3 w-4" />
          {project.emissions.gwp.toLocaleString("de-CH", {
            maximumFractionDigits: 0,
          })}
          {" kg CO₂eq"}
        </Badge>
      )}
    </div>
  );
}
