"use client";

import { useAppStore } from "@/lib/store";
import { useMemo } from "react";
import {
  computeHeatmapColors,
  computeMatchStatusColors,
  computeTypeColors,
} from "@/lib/viewer/color-engine";
import type { ColorMap } from "@/lib/viewer/color-engine";
import type { IndicatorKey } from "@/types/lca";
import { INDICATOR_REGISTRY } from "@/types/lca";
import { viewerRefs } from "@/lib/store/app-store";

function rgbaToCSS(c: [number, number, number, number]): string {
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`;
}

/**
 * Color legend overlay — shows the current coloring mode's legend
 * over the 3D viewer canvas. Positioned bottom-left.
 */
export function ColorLegend() {
  const { colorMode, parseResult, materials } = useAppStore();

  const colorMap: ColorMap | null = useMemo(() => {
    if (!parseResult) return null;

    const gToE = viewerRefs.guidToExpressId;

    switch (colorMode) {
      case "gwpTotal":
      case "penreTotal":
      case "ubp":
        return computeHeatmapColors(
          parseResult.elements,
          colorMode as IndicatorKey,
          materials,
          gToE,
        );
      case "matchStatus":
        return computeMatchStatusColors(
          parseResult.elements,
          materials,
          gToE,
        );
      case "elementType":
        return computeTypeColors(parseResult.elements, gToE);
      default:
        return null;
    }
  }, [colorMode, parseResult, materials]);

  if (!colorMap || colorMode === "none") return null;

  const isGradient = colorMode === "gwpTotal" || colorMode === "penreTotal" || colorMode === "ubp";
  const indicatorMeta = isGradient
    ? INDICATOR_REGISTRY[colorMode as IndicatorKey]
    : null;

  return (
    <div className="absolute bottom-3 left-3 z-20 rounded-lg border bg-background/90 p-2.5 shadow-md backdrop-blur-sm">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {isGradient
          ? `${indicatorMeta?.name ?? colorMode} (${indicatorMeta?.unit ?? ""})`
          : colorMode === "matchStatus"
            ? "Match Status"
            : "Element Type"}
      </div>

      {isGradient ? (
        /* Gradient legend */
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {colorMap.legend[0]?.label}
          </span>
          <div
            className="h-3 w-24 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${rgbaToCSS(colorMap.legend[0]?.color ?? [0, 0, 0, 1])}, ${rgbaToCSS(colorMap.legend[1]?.color ?? [0, 0, 0, 1])}, ${rgbaToCSS(colorMap.legend[2]?.color ?? [0, 0, 0, 1])})`,
            }}
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {colorMap.legend[2]?.label}
          </span>
        </div>
      ) : (
        /* Discrete legend */
        <div className="flex flex-col gap-0.5">
          {colorMap.legend.slice(0, 8).map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: rgbaToCSS(entry.color) }}
              />
              <span className="text-[10px] text-muted-foreground">{entry.label}</span>
            </div>
          ))}
          {colorMap.legend.length > 8 && (
            <span className="text-[10px] text-muted-foreground/60">
              +{colorMap.legend.length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
