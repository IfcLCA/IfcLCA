"use client";

import { Button } from "@/components/ui/button";
import { ProjectOverview } from "@/components/project-overview";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectsPage() {
  const handleMetricChange = (value: string) => {
    // Handle metric change
  };

  return (
    <div className="main-container">
      <section className="space-y-4">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">
              Manage and analyze your construction projects
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild>
              <Link href="/projects/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Project
              </Link>
            </Button>
            <Select defaultValue="GWP" onValueChange={handleMetricChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GWP">Global Warming Potential</SelectItem>
                <SelectItem value="PENR">
                  Primary Energy Non-Renewable
                </SelectItem>
                <SelectItem value="UBP">
                  UBP (Umweltbelastungspunkte)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ProjectOverview />
      </section>
    </div>
  );
}
