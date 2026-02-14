"use client";

import { useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";

/**
 * IFC 3D viewer component.
 *
 * This is the integration point for ifc-lite. Currently renders a
 * placeholder — the actual ifc-lite integration will be wired up
 * once the package is installed and configured.
 *
 * Architecture:
 * - ifc-lite handles WASM-based IFC parsing + WebGL rendering
 * - This component manages the canvas lifecycle
 * - Selection/hover events dispatch to the Zustand store
 * - Color mode changes trigger re-coloring via ifc-lite API
 */
export function IfcViewer() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    parseResult,
    selectedElementIds,
    hoveredElementId,
    colorMode,
    visibilityByType,
    selectElement,
    setHoveredElement,
  } = useAppStore();

  // Placeholder: in production, this initializes the ifc-lite viewer
  useEffect(() => {
    if (!canvasRef.current || !parseResult) return;

    // TODO: Initialize ifc-lite viewer
    // const viewer = new IfcLiteViewer(canvasRef.current);
    // viewer.loadModel(modelBuffer);
    // viewer.onSelect((guid) => selectElement(guid));
    // viewer.onHover((guid) => setHoveredElement(guid));
    //
    // return () => viewer.dispose();
  }, [parseResult, selectElement, setHoveredElement]);

  // Update colors when color mode changes
  useEffect(() => {
    // TODO: viewer.setColorMode(colorMode, heatmapData);
  }, [colorMode]);

  // Update selection highlighting
  useEffect(() => {
    // TODO: viewer.setSelection(Array.from(selectedElementIds));
  }, [selectedElementIds]);

  // Update visibility
  useEffect(() => {
    // TODO: viewer.setVisibility(visibilityByType);
  }, [visibilityByType]);

  if (!parseResult) return null;

  return (
    <div className="viewer-container" ref={canvasRef}>
      {/* Placeholder UI showing parse stats */}
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl font-bold text-primary">
            {parseResult.stats.elementCount}
          </div>
          <p className="text-sm text-muted-foreground">
            elements loaded from{" "}
            <span className="font-medium">
              {parseResult.projectInfo.name ?? "IFC model"}
            </span>
          </p>
          <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
            <span>{parseResult.stats.materialCount} materials</span>
            <span>{parseResult.storeys.length} storeys</span>
            <span>{parseResult.stats.parseTimeMs}ms parse time</span>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/60">
            3D viewer will render here once ifc-lite is integrated
          </p>
        </div>
      </div>
    </div>
  );
}
