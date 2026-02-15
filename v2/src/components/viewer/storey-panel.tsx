"use client";

import { useMemo } from "react";
import { Building, Eye, EyeOff, Focus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { frameElements } from "./ifc-viewer";
import type { MaterialWithMatch } from "@/lib/store/app-store";

/**
 * Storey navigation panel — shows building storeys with:
 * - Toggle visibility per storey
 * - Click storey → isolate its elements + frame camera
 * - Per-storey emission totals
 */
export function StoreyPanel() {
  const {
    parseResult,
    materials,
    visibilityByStorey,
    toggleStoreyVisibility,
    isolateElements,
  } = useAppStore();

  // Compute per-storey emissions
  const storeyData = useMemo(() => {
    if (!parseResult) return [];

    // Build material lookup for emission calculation
    const matLookup = new Map<string, MaterialWithMatch>();
    for (const mat of materials) {
      matLookup.set(mat.name, mat);
    }

    // Build element lookup
    const elementByGuid = new Map(
      parseResult.elements.map((e) => [e.guid, e])
    );

    return parseResult.storeys.map((storey) => {
      let gwp = 0;
      let elementCount = storey.elementGuids.length;

      for (const guid of storey.elementGuids) {
        const el = elementByGuid.get(guid);
        if (!el) continue;
        for (const layer of el.materials) {
          const mat = matLookup.get(layer.name);
          if (!mat?.matchedMaterial?.indicators || !mat.density) continue;
          const mass = layer.volume * (mat.density ?? 0);
          gwp += (mat.matchedMaterial.indicators.gwpTotal ?? 0) * mass;
        }
      }

      return {
        ...storey,
        elementCount,
        gwp,
      };
    });
  }, [parseResult, materials]);

  if (!parseResult || storeyData.length === 0) return null;

  const maxGwp = Math.max(...storeyData.map((s) => Math.abs(s.gwp)), 1);

  return (
    <div className="space-y-1">
      <h5 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Storeys
      </h5>
      {storeyData.map((storey) => {
        const isVisible = visibilityByStorey[storey.name] !== false;
        const gwpBar = maxGwp > 0 ? (Math.abs(storey.gwp) / maxGwp) * 100 : 0;

        return (
          <div
            key={storey.guid}
            className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent ${
              !isVisible ? "opacity-50" : ""
            }`}
          >
            {/* Visibility toggle */}
            <button
              onClick={() => toggleStoreyVisibility(storey.name)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title={isVisible ? "Hide storey" : "Show storey"}
            >
              {isVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </button>

            {/* Storey name + info */}
            <button
              className="flex flex-1 items-center gap-1.5 text-left"
              onClick={() => {
                const guids = new Set(storey.elementGuids);
                if (guids.size > 0) {
                  isolateElements(guids);
                  frameElements(guids);
                }
              }}
              title={`Isolate ${storey.name} (${storey.elementCount} elements)`}
            >
              <Building className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{storey.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {storey.elementCount}
              </span>
            </button>

            {/* Mini GWP bar */}
            {storey.gwp > 0 && (
              <div className="w-12 shrink-0" title={`GWP: ${storey.gwp.toFixed(1)} kg CO₂-eq`}>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500/70"
                    style={{ width: `${gwpBar}%` }}
                  />
                </div>
              </div>
            )}

            {/* Frame button (on hover) */}
            <button
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => {
                const guids = new Set(storey.elementGuids);
                if (guids.size > 0) frameElements(guids);
              }}
              title="Frame in 3D"
            >
              <Focus className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
