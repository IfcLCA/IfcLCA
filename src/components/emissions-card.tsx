"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowDown, ArrowUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type EmissionsProps = {
  gwp: number;
  ubp: number;
  penre: number;
};

type MetricKey = keyof EmissionsProps;

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
    unit: "UBP",
    description: "Environmental Impact Points",
  },
  penre: {
    label: "PENRE",
    unit: "MJ",
    description: "Primary Energy Non-Renewable",
  },
};

export function EmissionsCard({ emissions }: { emissions?: EmissionsProps }) {
  const [metric, setMetric] = useState<MetricKey>("gwp");

  if (!emissions) {
    return (
      <Card className="bg-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Total Emissions
          </CardTitle>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">
            No emissions data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentValue = emissions[metric];
  const formattedValue = currentValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const percentChange = 5.2; // Example percent change, replace with actual calculation

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Total Emissions</CardTitle>
        <Activity className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col space-y-6">
          <Select
            value={metric}
            onValueChange={(value) => setMetric(value as MetricKey)}
          >
            <SelectTrigger className="w-full">
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
          <div className="flex flex-col space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">{formattedValue}</span>
              <div
                className={cn(
                  "flex items-center text-sm",
                  percentChange > 0 ? "text-red-500" : "text-green-500"
                )}
              >
                {percentChange > 0 ? (
                  <ArrowUp className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDown className="h-4 w-4 mr-1" />
                )}
                {Math.abs(percentChange)}%
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{metrics[metric].unit}</span>
              <span>vs. last month</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Total {metrics[metric].label} for all materials in project
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
