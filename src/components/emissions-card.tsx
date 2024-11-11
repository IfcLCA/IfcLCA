"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmissionsProps = {
  gwp: number;
  ubp: number;
  penre: number;
};

export function EmissionsCard({ emissions }: { emissions?: EmissionsProps }) {
  const [metric, setMetric] = useState<"gwp" | "ubp" | "penre">("gwp");

  if (!emissions) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-2 bg-primary text-primary-foreground">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
          <Activity className="h-4 w-4 text-primary-foreground" />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-sm">Loading emissions data...</div>
        </CardContent>
      </Card>
    );
  }

  const metrics = {
    gwp: { value: emissions.gwp, unit: "kg CO₂ eq", label: "GWP" },
    ubp: { value: emissions.ubp, unit: "UBP", label: "UBP" },
    penre: { value: emissions.penre, unit: "MJ", label: "PENRE" },
  };

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-2 bg-primary text-primary-foreground">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
        <Activity className="h-4 w-4 text-primary-foreground" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col space-y-4">
          <Select
            value={metric}
            onValueChange={(value) => setMetric(value as typeof metric)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gwp">Global Warming Potential</SelectItem>
              <SelectItem value="ubp">UBP</SelectItem>
              <SelectItem value="penre">Primary Energy</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold">
              {metrics[metric].value.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              {metrics[metric].unit}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Total {metrics[metric].label} for all materials in project
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
