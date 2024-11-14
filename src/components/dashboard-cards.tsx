"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, BoxIcon, FileTextIcon, LayersIcon, GaugeIcon } from "lucide-react";
import { EmissionsCard } from "@/components/emissions-card";
import { ProjectImageUpload } from "@/components/project-image-upload";

type DashboardCardsProps = {
  elements?: number;
  uploads?: number;
  materials?: number;
  project?: any;
};

interface Indicators {
  gwp?: number;
  ubp?: number;
  penre?: number;
}

interface Material {
  indicators?: Indicators;
}

interface Element {
  materials: Material[];
}

export function DashboardCards({
  elements = 0,
  uploads = 0,
  materials = 0,
  project,
}: DashboardCardsProps) {
  const totalEmissions = project?.elements?.reduce(
    (acc: Indicators, element: Element) => {
      const elementTotals = element.materials.reduce(
        (materialAcc, material) => ({
          gwp: (materialAcc.gwp ?? 0) + (material.indicators?.gwp ?? 0),
          ubp: (materialAcc.ubp ?? 0) + (material.indicators?.ubp ?? 0),
          penre: (materialAcc.penre ?? 0) + (material.indicators?.penre ?? 0),
        }),
        { gwp: 0, ubp: 0, penre: 0 }
      );
      return {
        gwp: (acc.gwp ?? 0) + elementTotals.gwp,
        ubp: (acc.ubp ?? 0) + elementTotals.ubp,
        penre: (acc.penre ?? 0) + elementTotals.penre,
      };
    },
    { gwp: 0, ubp: 0, penre: 0 } as Indicators
  );

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      <div className="col-span-12 lg:col-span-5 h-full">
        <ProjectImageUpload
          projectId={project.id}
          imageUrl={project.imageUrl}
          className="h-full"
        />
      </div>

      <div className="col-span-12 lg:col-span-3 h-full">
        <div className="grid grid-cols-1 gap-4 h-full">
          <Card className="flex-1 group transition-colors duration-200 hover:border-primary/50">
            <CardContent className="px-4 pt-2 pb-3 flex flex-col">
              <div className="flex flex-row items-start justify-between mb-1">
                <h3 className="text-sm font-medium group-hover:text-primary transition-colors">Elements</h3>
                <BoxIcon className="h-6 w-6 text-foreground mt-1.5 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold leading-none mb-0.5 group-hover:text-primary transition-colors">{elements}</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">Construction components</p>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 group transition-colors duration-200 hover:border-primary/50">
            <CardContent className="px-4 pt-2 pb-3 flex flex-col">
              <div className="flex flex-row items-start justify-between mb-1">
                <h3 className="text-sm font-medium group-hover:text-primary transition-colors">Uploads</h3>
                <FileTextIcon className="h-6 w-6 text-foreground mt-1.5 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold leading-none mb-0.5 group-hover:text-primary transition-colors">{uploads}</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">Files analysed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 group transition-colors duration-200 hover:border-primary/50">
            <CardContent className="px-4 pt-2 pb-3 flex flex-col">
              <div className="flex flex-row items-start justify-between mb-1">
                <h3 className="text-sm font-medium group-hover:text-primary transition-colors">Materials</h3>
                <LayersIcon className="h-6 w-6 text-foreground mt-1.5 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold leading-none mb-0.5 group-hover:text-primary transition-colors">{materials}</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">Unique materials</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="col-span-12 lg:col-span-4 h-full group transition-colors duration-200 hover:border-primary/50">
        <CardContent className="px-4 pt-4 h-full flex flex-col">
          <div className="flex flex-row items-start justify-between mb-6">
            <h3 className="text-sm font-medium group-hover:text-primary transition-colors">Total Emissions</h3>
            <GaugeIcon className="h-6 w-6 text-foreground mt-1.5 group-hover:text-primary transition-colors" />
          </div>
          <EmissionsCard emissions={totalEmissions} />
        </CardContent>
      </Card>
    </div>
  );
}
