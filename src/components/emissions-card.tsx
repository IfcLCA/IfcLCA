"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

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
      <div className="h-full">
        <div className="text-sm text-muted-foreground">
          No emissions data available
        </div>
      </div>
    );
  }

  const currentValue = emissions[metric];
  const MILLION = 1_000_000;

  let formattedValue: string;
  let unit = metrics[metric].unit;

  if (currentValue >= MILLION) {
    formattedValue = (currentValue / MILLION).toLocaleString("de-CH", {
      maximumFractionDigits: 3,
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
    <div className="h-full flex flex-col group">
      <div className="flex flex-col justify-center flex-1 min-h-0">
        <p className="text-[clamp(2rem,5vw,4rem)] font-bold leading-none mb-2 group-hover:text-primary transition-colors">
          {formattedValue}
        </p>
        <p className="text-sm text-muted-foreground group-hover:text-primary/70 transition-colors">
          {unit}
        </p>
      </div>
      <div className="mt-6">
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
      </div>
    </div>
  );
}
