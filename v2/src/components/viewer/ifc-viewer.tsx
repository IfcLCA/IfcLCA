"use client";

import { useRef, useEffect, useCallback } from "react";
import { useAppStore, viewerRefs } from "@/lib/store/app-store";

/**
 * IFC 3D viewer component — integrates ifc-lite Renderer with WebGPU.
 *
 * Lifecycle:
 * 1. Mount → create <canvas>, init Renderer, store in viewerRefs
 * 2. Model loaded → meshes are already streamed in by the loader
 * 3. Click → pick() → resolve expressId → selectElement(guid)
 * 4. Hover → pick() → resolve expressId → setHoveredElement(guid)
 * 5. Unmount → dispose renderer
 *
 * The render loop runs on RAF and only re-renders when the camera moves
 * or selection/visibility state changes.
 */
export function IfcViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<unknown>(null);
  const cameraRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const initRef = useRef(false);

  const {
    parseResult,
    selectedElementIds,
    hoveredElementId,
    colorMode,
    visibilityByType,
    selectElement,
    toggleElementSelection,
    setHoveredElement,
    deselectAll,
  } = useAppStore();

  // Initialize renderer on mount
  useEffect(() => {
    if (!canvasRef.current || initRef.current) return;
    initRef.current = true;

    let disposed = false;

    (async () => {
      try {
        const { Renderer } = await import("@ifc-lite/renderer");
        if (disposed) return;

        const canvas = canvasRef.current!;
        const renderer = new Renderer(canvas);
        await renderer.init();

        if (disposed) return;

        rendererRef.current = renderer;
        viewerRefs.renderer = renderer;
        viewerRefs.canvas = canvas;

        // Access camera for orbit controls
        const camera = (renderer as any).camera;
        cameraRef.current = camera;

        // Start render loop
        let lastTime = performance.now();

        function renderLoop() {
          if (disposed) return;

          const now = performance.now();
          const dt = (now - lastTime) / 1000;
          lastTime = now;

          const cam = cameraRef.current as any;
          if (cam) {
            const moved = cam.update(dt);
            if (moved) {
              const r = rendererRef.current as any;
              // Build hidden IDs from visibility state
              const hiddenIds = new Set<number>();
              const state = useAppStore.getState();
              for (const [type, visible] of Object.entries(state.visibilityByType)) {
                if (!visible) {
                  // Find all expressIds of this type and hide them
                  // This requires the data store to be loaded
                  // For now, render without type filtering
                }
              }

              // Build selected IDs
              const selectedIds = new Set<number>();
              for (const guid of state.selectedElementIds) {
                const eid = viewerRefs.guidToExpressId.get(guid);
                if (eid !== undefined) selectedIds.add(eid);
              }

              r?.render({
                selectedIds: selectedIds.size > 0 ? selectedIds : undefined,
                hiddenIds: hiddenIds.size > 0 ? hiddenIds : undefined,
              });
            }
          }

          animFrameRef.current = requestAnimationFrame(renderLoop);
        }

        animFrameRef.current = requestAnimationFrame(renderLoop);

        // Initial render
        renderer.render();
      } catch (err) {
        console.error("Failed to initialize WebGPU renderer:", err);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current) {
        (rendererRef.current as any).dispose?.();
      }
      rendererRef.current = null;
      viewerRefs.renderer = null;
      viewerRefs.canvas = null;
      initRef.current = false;
    };
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (canvasRef.current) {
          canvasRef.current.width = width * devicePixelRatio;
          canvasRef.current.height = height * devicePixelRatio;
          canvasRef.current.style.width = `${width}px`;
          canvasRef.current.style.height = `${height}px`;
        }
        const r = rendererRef.current as any;
        const cam = cameraRef.current as any;
        if (r) r.resize(width * devicePixelRatio, height * devicePixelRatio);
        if (cam) cam.setAspect(width / height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force re-render when selection changes
  useEffect(() => {
    const r = rendererRef.current as any;
    if (!r) return;

    const selectedIds = new Set<number>();
    for (const guid of selectedElementIds) {
      const eid = viewerRefs.guidToExpressId.get(guid);
      if (eid !== undefined) selectedIds.add(eid);
    }

    r.render({
      selectedIds: selectedIds.size > 0 ? selectedIds : undefined,
    });
  }, [selectedElementIds]);

  // Handle click → pick
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const r = rendererRef.current as any;
      if (!r) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * devicePixelRatio;
      const y = (e.clientY - rect.top) * devicePixelRatio;

      const result = await r.pick(x, y);

      if (result?.expressId) {
        const guid = viewerRefs.expressIdToGuid.get(result.expressId);
        if (guid) {
          if (e.ctrlKey || e.metaKey) {
            toggleElementSelection(guid);
          } else {
            selectElement(guid);
          }
        }
      } else {
        deselectAll();
      }
    },
    [selectElement, toggleElementSelection, deselectAll]
  );

  // Handle mouse move → hover
  const handleMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const r = rendererRef.current as any;
      if (!r) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * devicePixelRatio;
      const y = (e.clientY - rect.top) * devicePixelRatio;

      const result = await r.pick(x, y);

      if (result?.expressId) {
        const guid = viewerRefs.expressIdToGuid.get(result.expressId);
        setHoveredElement(guid ?? null);
      } else {
        setHoveredElement(null);
      }
    },
    [setHoveredElement]
  );

  // Fit to model bounds when parseResult arrives
  useEffect(() => {
    if (!parseResult || !rendererRef.current) return;

    const r = rendererRef.current as any;
    const scene = r.scene;
    if (scene) {
      const bounds = scene.getBounds();
      if (bounds) {
        const cam = cameraRef.current as any;
        cam?.fitToBounds(bounds.min, bounds.max);
        r.render();
      }
    }
  }, [parseResult]);

  if (!parseResult && !useAppStore.getState().modelLoading) return null;

  return (
    <div ref={containerRef} className="viewer-container">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="h-full w-full"
        style={{ touchAction: "none" }}
      />
      {/* Loading overlay */}
      {useAppStore.getState().modelLoading && (
        <LoadingOverlay />
      )}
    </div>
  );
}

function LoadingOverlay() {
  const loadProgress = useAppStore((s) => s.loadProgress);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="rounded-lg border bg-card p-6 text-center shadow-lg">
        <div className="mb-3 text-sm font-medium">
          {loadProgress?.message ?? "Loading..."}
        </div>
        {loadProgress && (
          <div className="h-2 w-48 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${loadProgress.percent}%` }}
            />
          </div>
        )}
        {loadProgress?.meshCount !== undefined && (
          <div className="mt-2 text-xs text-muted-foreground">
            {loadProgress.meshCount} meshes loaded
          </div>
        )}
      </div>
    </div>
  );
}
