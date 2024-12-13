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
import { useProjectEmissions } from "@/hooks/use-project-emissions";

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

export function EmissionsSummaryCard({ project }: { project?: Project }) {
  const [metric, setMetric] = useState<MetricKey>("gwp");
  const { totals, formatted, units } = useProjectEmissions(project);

  if (!project?.elements?.length) {
    return (
      <div className="flex flex-col justify-center text-center py-4">
        <div className="text-sm text-muted-foreground">
          No emissions data available
        </div>
      </div>
    );
  }

  const currentValue = totals[metric];
  const unit = units[metric];
  const currentMetric = metrics[metric];

  const MILLION = 1_000_000;
  let formattedValue: string;
  let displayUnit = unit;

  if (currentValue >= MILLION) {
    formattedValue = (currentValue / MILLION).toLocaleString("de-CH", {
      maximumFractionDigits: 3,
      minimumFractionDigits: 1,
      useGrouping: true,
    });
    displayUnit = `Mio. ${unit}`;
  } else {
    formattedValue = currentValue.toLocaleString("de-CH", {
      maximumFractionDigits: 0,
      useGrouping: true,
    });
  }

  // Calculate dynamic text size based on number length
  const getTextSize = (value: string) => {
    const length = value.length;
    if (length <= 4) return "text-[clamp(3rem,min(16vw,12vh),8rem)]";
    if (length <= 6) return "text-[clamp(2.5rem,min(14vw,10vh),7rem)]";
    if (length <= 8) return "text-[clamp(2rem,min(12vw,8vh),6rem)]";
    return "text-[clamp(1.75rem,min(10vw,6vh),5rem)]";
  };

  return (
    <div className="flex flex-col h-[calc(100%-2rem)]">
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <p
          className={`${getTextSize(
            formattedValue
          )} font-bold leading-[0.9] mb-1 group-hover:text-primary transition-colors text-center`}
        >
          {formattedValue}
        </p>
        <p className="text-sm text-muted-foreground/80 group-hover:text-primary/70 transition-colors text-center">
          {displayUnit}
        </p>
      </div>
      <Select
        value={metric}
        onValueChange={(value) => setMetric(value as MetricKey)}
      >
        <SelectTrigger className="w-full text-sm">
          <SelectValue placeholder="Select metric">
            {currentMetric.description}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(metrics).map(([key, { description }]) => (
            <SelectItem key={key} value={key} className="text-sm">
              {description}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
