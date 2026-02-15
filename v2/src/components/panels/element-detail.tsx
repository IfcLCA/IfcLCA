"use client";

import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Layers, Box, Focus } from "lucide-react";
import { frameElements } from "@/components/viewer/ifc-viewer";

export function ElementDetail() {
  const {
    parseResult,
    selectedElementIds,
    materials,
    deselectAll,
    setSelectedMaterial,
  } = useAppStore();

  if (!parseResult || selectedElementIds.size === 0) return null;

  const selectedElements = parseResult.elements.filter((el) =>
    selectedElementIds.has(el.guid)
  );

  if (selectedElements.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Selected element not found in model
      </div>
    );
  }

  const element = selectedElements[0];

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Element Detail
          </h3>
          <p className="mt-1 font-medium">{element.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => frameElements(selectedElementIds)}
            title="Frame in 3D"
          >
            <Focus className="h-3.5 w-3.5" />
            Frame
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={deselectAll}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Properties */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {element.type}
          </Badge>
          {element.isExternal && (
            <Badge variant="secondary" className="text-xs">
              External
            </Badge>
          )}
          {element.loadBearing && (
            <Badge variant="secondary" className="text-xs">
              Load-bearing
            </Badge>
          )}
        </div>

        {element.classification && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Classification</p>
            <p className="text-sm font-medium">
              {element.classification.code} — {element.classification.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {element.classification.system}
            </p>
          </div>
        )}

        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="text-sm font-medium">
            {element.totalVolume.toFixed(4)} m³
          </p>
        </div>
      </div>

      {/* Material layers */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Materials ({element.materials.length})
        </h4>
        {element.materials.map((mat, i) => {
          const appMaterial = materials.find((m) => m.name === mat.name);
          const isMatched = !!appMaterial?.match;

          return (
            <button
              key={i}
              className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              onClick={() => setSelectedMaterial(mat.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{mat.name}</span>
                </div>
                <Badge
                  variant={isMatched ? "matched" : "unmatched"}
                  className="text-xs"
                >
                  {isMatched ? "Matched" : "Unmatched"}
                </Badge>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                <span>{mat.volume.toFixed(4)} m³</span>
                <span>{(mat.fraction * 100).toFixed(1)}%</span>
                {mat.thickness && <span>{(mat.thickness * 1000).toFixed(0)} mm</span>}
              </div>
              {isMatched && appMaterial?.density && appMaterial.indicators && (
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground/80">
                  {(() => {
                    const mass = mat.volume * (appMaterial.density ?? 0);
                    const gwp = appMaterial.indicators?.gwpTotal != null ? mass * appMaterial.indicators.gwpTotal : null;
                    const ubp = appMaterial.indicators?.ubp != null ? mass * appMaterial.indicators.ubp : null;
                    return (
                      <>
                        {gwp != null && <span>GWP: {gwp.toFixed(2)} kg CO₂-eq</span>}
                        {ubp != null && <span>UBP: {ubp.toFixed(0)}</span>}
                      </>
                    );
                  })()}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Multi-selection info */}
      {selectedElements.length > 1 && (
        <p className="text-xs text-muted-foreground">
          +{selectedElements.length - 1} more elements selected
        </p>
      )}
    </div>
  );
}
