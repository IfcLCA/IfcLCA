"use client";

import { Button } from "@/components/ui/button";
import { ProjectOverview } from "@/components/project-overview";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectsPage() {
  const [selectedMetric, setSelectedMetric] = useState("gwp");

  const handleMetricChange = (value: string) => {
    setSelectedMetric(value);
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
            <Select value={selectedMetric} onValueChange={handleMetricChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gwp">Global Warming Potential</SelectItem>
                <SelectItem value="penre">
                  Primary Energy Non-Renewable
                </SelectItem>
                <SelectItem value="ubp">
                  UBP (Umweltbelastungspunkte)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ProjectOverview selectedMetric={selectedMetric} />
      </section>
    </div>
  );
}
