"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowDown, ArrowUp, Construction } from "lucide-react";
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
    unit: "kWh",
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
  const formattedValue = currentValue.toLocaleString("de-CH", {
    maximumFractionDigits: 0,
    useGrouping: true,
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
              <div className="relative group">
                <div className="blur-[1px] opacity-40">
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
                <div className="absolute inset-0 flex items-center justify-end pr-1">
                  <div className="bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-black/10 dark:border-white/10 px-2.5 py-1 text-xs rounded-full flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                    </span>
                    <span className="text-muted-foreground">Coming Soon</span>
                  </div>
                </div>
                <div className="absolute invisible group-hover:visible bg-popover text-popover-foreground px-2 py-1 text-xs rounded-md shadow-lg -top-8 right-0 whitespace-nowrap">
                  Historical data coming soon
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{metrics[metric].unit}</span>
              <span className="opacity-40">vs. last month</span>
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
