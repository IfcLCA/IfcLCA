"use client";

import { useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { IndicatorKey } from "@/types/lca";
import { useAppStore } from "@/lib/store";
import { frameElements } from "@/components/viewer/ifc-viewer";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const CHART_COLORS = [
  "hsl(142, 76%, 36%)", // green-600
  "hsl(221, 83%, 53%)", // blue-600
  "hsl(25, 95%, 53%)",  // orange-500
  "hsl(262, 83%, 58%)", // purple-500
  "hsl(350, 89%, 60%)", // red-500
  "hsl(47, 96%, 53%)",  // yellow-500
  "hsl(173, 80%, 40%)", // teal-600
  "hsl(292, 84%, 61%)", // fuchsia-500
  "hsl(198, 93%, 60%)", // sky-400
  "hsl(15, 75%, 28%)",  // brown
];

const HIGHLIGHT_COLOR = "hsl(48, 96%, 60%)"; // bright yellow highlight

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartDataRow {
  name: string;
  gwp: number;
  penre: number;
  ubp: number;
  volume?: number;
}

type ChartType = "bar" | "pie";

interface EmissionsChartProps {
  data: ChartDataRow[];
  title: string;
  defaultIndicator?: IndicatorKey;
  height?: number;
  /** Map from data row name → Set of element GUIDs. Enables 3D interaction. */
  elementGroups?: Map<string, Set<string>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmissionsChart({
  data,
  title,
  defaultIndicator = "gwpTotal",
  height = 250,
  elementGroups,
}: EmissionsChartProps) {
  const [indicator, setIndicator] = useState<"gwp" | "penre" | "ubp">(
    defaultIndicator === "penreTotal"
      ? "penre"
      : defaultIndicator === "ubp"
      ? "ubp"
      : "gwp"
  );
  const [chartType, setChartType] = useState<ChartType>("bar");

  const { isolateElements, highlightElements, clearHighlight, selectedElementIds, parseResult } =
    useAppStore();

  const indicatorMeta = {
    gwp: { label: "GWP", unit: "kg CO\u2082-eq", key: "gwpTotal" as IndicatorKey },
    penre: { label: "PENRE", unit: "MJ", key: "penreTotal" as IndicatorKey },
    ubp: { label: "UBP", unit: "UBP", key: "ubp" as IndicatorKey },
  };

  const meta = indicatorMeta[indicator];

  // Sort by selected indicator desc, take top 10
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => Math.abs(b[indicator]) - Math.abs(a[indicator]))
      .slice(0, 10)
      .map((d) => ({
        name: d.name.length > 25 ? d.name.substring(0, 22) + "..." : d.name,
        fullName: d.name,
        value: d[indicator],
      }));
  }, [data, indicator]);

  // Determine which chart entries correspond to selected elements
  const selectedNames = useMemo(() => {
    if (!selectedElementIds || selectedElementIds.size === 0 || !parseResult) return new Set<string>();
    const names = new Set<string>();
    for (const guid of selectedElementIds) {
      const el = parseResult.elements.find((e) => e.guid === guid);
      if (el) {
        for (const mat of el.materials) names.add(mat.name);
      }
    }
    return names;
  }, [selectedElementIds, parseResult]);

  // Chart click → isolate elements in 3D
  const handleBarClick = useCallback(
    (data: any) => {
      if (!elementGroups) return;
      const fullName = data?.fullName ?? data?.name;
      if (!fullName) return;
      const guids = elementGroups.get(fullName);
      if (guids && guids.size > 0) {
        isolateElements(guids);
        frameElements(guids);
      }
    },
    [elementGroups, isolateElements],
  );

  // Chart hover → highlight elements in 3D
  const handleBarMouseEnter = useCallback(
    (_: any, index: number) => {
      if (!elementGroups) return;
      const entry = chartData[index];
      if (!entry) return;
      const guids = elementGroups.get(entry.fullName);
      if (guids) highlightElements(guids);
    },
    [elementGroups, chartData, highlightElements],
  );

  const handleBarMouseLeave = useCallback(() => {
    clearHighlight();
  }, [clearHighlight]);

  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + Math.abs(d[indicator]), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h5>
        <div className="flex items-center gap-1">
          {/* Indicator toggle */}
          {(["gwp", "penre", "ubp"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setIndicator(key)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                indicator === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {indicatorMeta[key].label}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/30">|</span>
          {/* Chart type toggle */}
          <button
            onClick={() => setChartType(chartType === "bar" ? "pie" : "bar")}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            {chartType === "bar" ? "Pie" : "Bar"}
          </button>
        </div>
      </div>

      {chartType === "bar" ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => [
                `${value.toFixed(2)} ${meta.unit}`,
                meta.label,
              ]}
              labelFormatter={(label: string) => {
                const item = chartData.find((d) => d.name === label);
                return item?.fullName ?? label;
              }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              onClick={handleBarClick}
              onMouseEnter={handleBarMouseEnter}
              onMouseLeave={handleBarMouseLeave}
              style={elementGroups ? { cursor: "pointer" } : undefined}
            >
              {chartData.map((entry, idx) => {
                const isSelected = selectedNames.has(entry.fullName);
                return (
                  <Cell
                    key={idx}
                    fill={isSelected ? HIGHLIGHT_COLOR : CHART_COLORS[idx % CHART_COLORS.length]}
                    stroke={isSelected ? "#000" : undefined}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
              style={{ fontSize: 9, cursor: elementGroups ? "pointer" : undefined }}
              onClick={handleBarClick}
            >
              {chartData.map((entry, idx) => {
                const isSelected = selectedNames.has(entry.fullName);
                return (
                  <Cell
                    key={idx}
                    fill={isSelected ? HIGHLIGHT_COLOR : CHART_COLORS[idx % CHART_COLORS.length]}
                    stroke={isSelected ? "#000" : undefined}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${value.toFixed(2)} ${meta.unit}`,
                meta.label,
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Legend with totals */}
      <div className="text-[10px] text-muted-foreground text-right">
        Total: {total.toFixed(2)} {meta.unit}
        {elementGroups && (
          <span className="ml-2 text-muted-foreground/50">Click bar to isolate in 3D</span>
        )}
      </div>
    </div>
  );
}
