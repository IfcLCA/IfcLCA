"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import Link from "next/link";

type ImpactMetric = "GWP" | "PENR" | "UBP";

type Project = {
  id: string;
  name: string;
  description: string;
  image: string;
  environmentalImpact: {
    GWP: number; // Global Warming Potential (kg CO2 eq)
    PENR: number; // Primary Energy Non-Renewable (MJ)
    UBP: number; // UBP (Environmental Impact Points)
  };
};

const allProjects: Project[] = [
  {
    id: "1",
    name: "Green Office Tower",
    description:
      "30-story office building with LEED Platinum certification goal",
    image: "/placeholder.svg?height=400&width=600",
    environmentalImpact: { GWP: 5000000, PENR: 75000000, UBP: 500000000 },
  },
  {
    id: "2",
    name: "Sustainable Housing Complex",
    description: "200-unit residential complex with net-zero energy goal",
    image: "/placeholder.svg?height=400&width=600",
    environmentalImpact: { GWP: 3000000, PENR: 45000000, UBP: 300000000 },
  },
  {
    id: "3",
    name: "Eco-Friendly School",
    description: "K-12 school designed for minimal environmental impact",
    image: "/placeholder.svg?height=400&width=600",
    environmentalImpact: { GWP: 2000000, PENR: 30000000, UBP: 200000000 },
  },
  {
    id: "4",
    name: "Green Data Center",
    description: "Energy-efficient data center with advanced cooling systems",
    image: "/placeholder.svg?height=400&width=600",
    environmentalImpact: { GWP: 8000000, PENR: 120000000, UBP: 800000000 },
  },
  {
    id: "5",
    name: "Sustainable Airport Terminal",
    description: "Airport terminal designed for minimal carbon footprint",
    image: "/placeholder.svg?height=400&width=600",
    environmentalImpact: { GWP: 10000000, PENR: 150000000, UBP: 1000000000 },
  },
];

const impactUnits: Record<ImpactMetric, string> = {
  GWP: "kg CO₂ eq",
  PENR: "MJ",
  UBP: "pts",
};

export function ProjectOverview() {
  const [selectedMetric, setSelectedMetric] = useState<ImpactMetric>("GWP");
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 6;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Calculate pagination
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = allProjects.slice(
    indexOfFirstProject,
    indexOfLastProject
  );

  const formatImpact = (value: number, metric: ImpactMetric) => {
    if (metric === "GWP") {
      return `${(value / 1000000).toFixed(2)} million ${impactUnits[metric]}`;
    } else if (metric === "PENR") {
      return `${(value / 1000000).toFixed(2)} million ${impactUnits[metric]}`;
    } else {
      return `${(value / 1000000).toFixed(2)} million ${impactUnits[metric]}`;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">All Projects</h2>
        <div className="flex items-center space-x-4">
          <Select
            value={selectedMetric}
            onValueChange={(value: ImpactMetric) => setSelectedMetric(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GWP">Global Warming Potential</SelectItem>
              <SelectItem value="PENR">Primary Energy Non-Renewable</SelectItem>
              <SelectItem value="UBP">Environmental Impact Points</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentProjects.map((project) => (
          <Card key={project.id} className="overflow-hidden">
            <Image
              src={project.image}
              alt={project.name}
              width={600}
              height={400}
              className="object-cover w-full h-48"
            />
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {project.description}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{selectedMetric}</span>
                  <span className="font-medium">
                    {formatImpact(
                      project.environmentalImpact[selectedMetric],
                      selectedMetric
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="outline" size="sm">
                    View Details
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {allProjects.length > projectsPerPage && (
        <div className="flex justify-center mt-6">
          {Array.from({
            length: Math.ceil(allProjects.length / projectsPerPage),
          }).map((_, index) => (
            <Button
              key={index}
              variant={currentPage === index + 1 ? "default" : "outline"}
              size="sm"
              className="mx-1"
              onClick={() => handlePageChange(index + 1)}
            >
              {index + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
