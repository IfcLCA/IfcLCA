"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, BoxIcon, FileTextIcon, LayersIcon } from "lucide-react";
import { EmissionsCard } from "@/components/emissions-card";

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
    <div className="grid grid-cols-12 gap-6">
      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Project Image</CardTitle>
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="aspect-video flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground mb-4 text-center px-2">
              No project image uploaded
            </p>
            <Button
              variant="outline"
              size="sm"
              className="relative overflow-hidden"
            >
              <ImageIcon className="h-3 w-3 mr-2" />
              Upload
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-8">
        <EmissionsCard emissions={totalEmissions} />
      </Card>

      <Card className="col-span-4 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Elements</CardTitle>
          <BoxIcon className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{elements}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Construction components
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-4 bg-gradient-to-br from-secondary/5 to-secondary/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Uploads</CardTitle>
          <FileTextIcon className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{uploads}</p>
          <p className="text-xs text-muted-foreground mt-1">Files analysed</p>
        </CardContent>
      </Card>

      <Card className="col-span-4 bg-gradient-to-br from-accent/5 to-accent/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Materials</CardTitle>
          <LayersIcon className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{materials}</p>
          <p className="text-xs text-muted-foreground mt-1">Unique materials</p>
        </CardContent>
      </Card>
    </div>
  );
}
