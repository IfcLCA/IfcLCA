"use client";

import { useState } from "react";
import { BarChart2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type MetricKey = "gwp" | "ubp" | "penre";

const metrics: Record<
  MetricKey,
  { label: string; unit: string; description: string }
> = {
  gwp: {
    label: "GWP",
    unit: "kg CO₂ eq",
    description: "Global Warming Potential",
  },
  ubp: {
    label: "UBP",
    unit: "pts",
    description: "Environmental Impact Points",
  },
  penre: {
    label: "PENRE",
    unit: "kWh",
    description: "Primary Energy Non-Renewable",
  },
};

interface DashboardEmissionsCardProps {
  emissions?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  isLoading?: boolean;
}

export function DashboardEmissionsCard({
  emissions,
  isLoading = false,
}: DashboardEmissionsCardProps) {
  const [metric, setMetric] = useState<MetricKey>("gwp");

  if (isLoading) {
    return (
      <Card className="group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col h-full">
            <div className="flex flex-col justify-center flex-1 min-h-0">
              <Skeleton className="h-8 w-32 mb-2" />
            </div>
            <Skeleton className="h-10 w-full mt-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!emissions) {
    return (
      <Card className="group h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
          <BarChart2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No emissions data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentValue = emissions[metric];
  const unit = metrics[metric].unit;

  const MILLION = 1_000_000;
  const fractionDigits = 0; // Dashboard always uses absolute mode

  let formattedValue: string;

  if (currentValue >= MILLION) {
    formattedValue = (currentValue / MILLION).toLocaleString("de-CH", {
      maximumFractionDigits: Math.max(1, fractionDigits),
      minimumFractionDigits: Math.max(1, fractionDigits),
      useGrouping: true,
    });
    formattedValue = `${formattedValue} Mio.`;
  } else {
    formattedValue = currentValue.toLocaleString("de-CH", {
      maximumFractionDigits: fractionDigits,
      useGrouping: true,
    });
  }

  // Full number for tooltip
  const fullNumber = currentValue.toLocaleString("de-CH", {
    maximumFractionDigits: 0,
    useGrouping: true,
  });

  return (
    <Card className="group h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
        <BarChart2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-full">
          <div className="flex flex-col justify-center flex-1 min-h-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-2xl font-bold group-hover:text-primary transition-colors cursor-help">
                    {formattedValue}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {unit}
                    </span>
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono">{fullNumber}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={metric}
            onValueChange={(value) => setMetric(value as MetricKey)}
          >
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(metrics).map(([key, { description }]) => (
                <SelectItem key={key} value={key}>
                  {description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
