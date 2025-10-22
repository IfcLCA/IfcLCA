"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectEmissions } from "@/hooks/use-project-emissions";
import type { Project } from "@/types/project";
import { useState } from "react";

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
  const [displayMode, setDisplayMode] = useState<'absolute' | 'relative'>('absolute');

  // Always use computed hook values as they properly handle displayMode
  const computed = useProjectEmissions(project, displayMode);

  const totals = computed.totals;
  const units = computed.units;

  const hasElements = project?.elements?.length;
  const hasAggregatedEmissions = Boolean(project?.emissions);

  if (!hasElements && !hasAggregatedEmissions) {
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
    // Show more precision for relative values
    const fractionDigits = displayMode === 'relative' ? 3 : 0;
    formattedValue = currentValue.toLocaleString("de-CH", {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: displayMode === 'relative' ? 3 : 0,
      useGrouping: true,
    });
  }

  // Calculate dynamic text size based on number length
  const getTextSize = (value: string) => {
    const length = value.length;
    if (length <= 5) return "text-6xl";
    if (length <= 7) return "text-5xl";
    if (length <= 9) return "text-4xl";
    if (length <= 11) return "text-3xl";
    return "text-2xl";
  };

  return (
    <div className="flex flex-col h-full p-6 group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          {currentMetric.description}
        </p>

        <Tabs value={displayMode} onValueChange={(v) => setDisplayMode(v as 'absolute' | 'relative')}>
          <TabsList className="h-8">
            <TabsTrigger value="absolute" className="text-xs px-3">
              Absolute
            </TabsTrigger>
            <TabsTrigger
              value="relative"
              className="text-xs px-3"
              disabled={!project?.calculationArea?.value || project.calculationArea.value <= 0}
              title={!project?.calculationArea ? 'Set area (EBF/GFA/NFA) to enable relative mode' : ''}
            >
              Relative
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Metric selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.entries(metrics).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setMetric(key as MetricKey)}
            className={`px-3 py-2.5 rounded-md text-xs font-medium transition-all ${metric === key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main value display */}
      <div className="flex flex-col justify-center items-center flex-1 px-2">
        <p className={`${getTextSize(formattedValue)} font-bold leading-tight group-hover:text-primary transition-colors text-center`}>
          {formattedValue}
        </p>
        <p className="text-sm text-muted-foreground/80 group-hover:text-primary/70 transition-colors mt-2 text-center">
          {displayUnit}
        </p>
      </div>
    </div>
  );
}
