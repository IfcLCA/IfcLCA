"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useAppStore, viewerRefs } from "@/lib/store/app-store";
import { AlertCircle } from "lucide-react";

/**
 * IFC 3D viewer component — integrates ifc-lite Renderer with WebGPU.
 *
 * Lifecycle:
 * 1. Mount → detect WebGPU → create <canvas>, init Renderer, store in viewerRefs
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
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);

  const {
    parseResult,
    selectedElementIds,
    selectElement,
    toggleElementSelection,
    setHoveredElement,
    deselectAll,
  } = useAppStore();

  // Detect WebGPU support on mount
  useEffect(() => {
    (async () => {
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        setWebGPUSupported(false);
        return;
      }
      try {
        const gpu = navigator.gpu as GPU | undefined;
        if (!gpu) {
          setWebGPUSupported(false);
          return;
        }
        const adapter = await gpu.requestAdapter();
        setWebGPUSupported(adapter !== null);
      } catch {
        setWebGPUSupported(false);
      }
    })();
  }, []);

  // Initialize renderer once WebGPU is confirmed
  useEffect(() => {
    if (webGPUSupported !== true || !canvasRef.current || initRef.current)
      return;
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

        // Notify waiting upload zone that renderer is ready
        viewerRefs.rendererReadyResolve?.();

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
              const state = useAppStore.getState();

              // Build selected IDs
              const selectedIds = new Set<number>();
              for (const guid of state.selectedElementIds) {
                const eid = viewerRefs.guidToExpressId.get(guid);
                if (eid !== undefined) selectedIds.add(eid);
              }

              // Build hidden IDs from type visibility
              const hiddenIds = new Set<number>();
              const ds = viewerRefs.dataStore as any;
              if (ds?.entities) {
                for (const [type, visible] of Object.entries(
                  state.visibilityByType
                )) {
                  if (!visible) {
                    const ids = ds.entities.getByType?.(type) ?? [];
                    for (const id of ids) hiddenIds.add(id);
                  }
                }
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
        renderer.render();
      } catch (err) {
        console.error("Failed to initialize WebGPU renderer:", err);
        setWebGPUSupported(false);
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
  }, [webGPUSupported]);

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

  // Handle mouse move → hover (throttled)
  const lastHoverRef = useRef(0);
  const handleMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const now = Date.now();
      if (now - lastHoverRef.current < 50) return; // 20fps throttle
      lastHoverRef.current = now;

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

  // WebGPU not supported fallback
  if (webGPUSupported === false) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-8">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-semibold">WebGPU Not Available</h3>
          <p className="text-sm text-muted-foreground">
            Your browser doesn&apos;t support WebGPU, which is required for the
            3D viewer. Please use Chrome 113+, Edge 113+, or Firefox Nightly
            with WebGPU enabled.
          </p>
          <p className="mt-3 text-xs text-muted-foreground/60">
            The materials table and LCA matching still work without the 3D
            viewer.
          </p>
        </div>
      </div>
    );
  }

  // Still detecting
  if (webGPUSupported === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Checking WebGPU support...
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="viewer-container">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="h-full w-full"
        style={{ touchAction: "none" }}
      />
      <LoadingOverlay />
    </div>
  );
}

function LoadingOverlay() {
  const modelLoading = useAppStore((s) => s.modelLoading);
  const loadProgress = useAppStore((s) => s.loadProgress);

  if (!modelLoading) return null;

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
