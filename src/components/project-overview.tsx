"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type ImpactMetric = "GWP" | "PENR" | "UBP";

type Project = {
  id: string;
  name: string;
  description: string;
  environmentalImpact: {
    GWP: number;
    PENR: number;
    UBP: number;
  };
};

const allProjects: Project[] = [
  {
    id: "1",
    name: "Green Office Tower",
    description:
      "30-story office building with LEED Platinum certification goal",
    environmentalImpact: { GWP: 5000000, PENR: 75000000, UBP: 500000000 },
  },
  {
    id: "2",
    name: "Sustainable Housing Complex",
    description: "200-unit residential complex with net-zero energy goal",
    environmentalImpact: { GWP: 3000000, PENR: 45000000, UBP: 300000000 },
  },
  {
    id: "3",
    name: "Eco-Friendly School",
    description: "K-12 school designed for minimal environmental impact",
    environmentalImpact: { GWP: 2000000, PENR: 30000000, UBP: 200000000 },
  },
  {
    id: "4",
    name: "Green Data Center",
    description: "Energy-efficient data center with advanced cooling systems",
    environmentalImpact: { GWP: 8000000, PENR: 120000000, UBP: 800000000 },
  },
  {
    id: "5",
    name: "Sustainable Airport Terminal",
    description: "Airport terminal designed for minimal carbon footprint",
    environmentalImpact: { GWP: 10000000, PENR: 150000000, UBP: 1000000000 },
  },
];

const impactUnits: Record<ImpactMetric, string> = {
  GWP: "kg CO₂ eq",
  PENR: "MJ",
  UBP: "pts",
};

const metricLabels: Record<ImpactMetric, string> = {
  GWP: "Global Warming Potential",
  PENR: "Primary Energy Non-Renewable",
  UBP: "Environmental Impact Points",
};

export function ProjectOverview() {
  const [selectedMetric, setSelectedMetric] = useState<ImpactMetric>("GWP");
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 6;

  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = allProjects.slice(
    indexOfFirstProject,
    indexOfLastProject
  );

  const formatImpact = (value: number, metric: ImpactMetric) => {
    const formattedValue = (value / 1000000).toFixed(2);
    return `${formattedValue} million ${impactUnits[metric]}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Project Portfolio</h1>
        <div className="flex items-center gap-4">
          <Select
            value={selectedMetric}
            onValueChange={(value: ImpactMetric) => setSelectedMetric(value)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={metricLabels[selectedMetric]} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(metricLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild size="lg">
            <Link href="/projects/new" className="gap-2">
              <Plus className="h-5 w-5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentProjects.map((project) => (
          <Card
            key={project.id}
            className="group relative transition-all hover:shadow-lg"
          >
            <Badge
              variant="secondary"
              className="absolute right-6 top-6 h-8 w-8 rounded-full p-0 flex items-center justify-center text-sm font-medium"
            >
              {project.id}
            </Badge>
            <CardContent className="p-6 pt-12">
              <h2 className="text-xl font-semibold mb-2">{project.name}</h2>
              <p className="text-muted-foreground mb-6">
                {project.description}
              </p>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {metricLabels[selectedMetric]}
                </div>
                <div className="font-mono text-lg">
                  {formatImpact(
                    project.environmentalImpact[selectedMetric],
                    selectedMetric
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button
                asChild
                variant="ghost"
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              >
                <Link href={`/projects/${project.id}`} className="gap-2">
                  View Details
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {allProjects.length > projectsPerPage && (
        <nav className="flex justify-center mt-8" aria-label="Pagination">
          <ul className="inline-flex gap-2">
            {Array.from({
              length: Math.ceil(allProjects.length / projectsPerPage),
            }).map((_, index) => (
              <li key={index}>
                <Button
                  variant={currentPage === index + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(index + 1)}
                  aria-current={currentPage === index + 1 ? "page" : undefined}
                >
                  {index + 1}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
