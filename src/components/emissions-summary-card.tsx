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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    unit: "pts",
    description: "Environmental Impact Points",
  },
  penre: {
    label: "PENRE",
    unit: "kWh",
    description: "Primary Energy Non-Renewable",
  },
};

export function EmissionsSummaryCard({ emissions }: { emissions?: EmissionsProps }) {
  const [metric, setMetric] = useState<MetricKey>("gwp");

  if (!emissions) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tracked Emissions</CardTitle>
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
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
  const MILLION = 1_000_000;
  
  let formattedValue: string;
  let unit = metrics[metric].unit;
  
  if (currentValue >= MILLION) {
    formattedValue = (currentValue / MILLION).toLocaleString("de-CH", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
      useGrouping: true,
    });
    formattedValue = `${formattedValue} Mio.`;
  } else {
    formattedValue = currentValue.toLocaleString("de-CH", {
      maximumFractionDigits: 0,
      useGrouping: true,
    });
  }

  return (
    <Card className="group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Tracked Emissions</CardTitle>
        <BarChart2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          <div className="flex flex-col justify-center flex-1 min-h-0">
            <p className="text-2xl font-bold group-hover:text-primary transition-colors">
              {formattedValue}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {unit}
              </span>
            </p>
          </div>
          <Select
            value={metric}
            onValueChange={(value) => setMetric(value as MetricKey)}
            className="mt-4"
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
        </div>
      </CardContent>
    </Card>
  );
}
