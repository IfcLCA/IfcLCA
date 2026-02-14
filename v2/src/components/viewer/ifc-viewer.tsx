"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useAppStore, viewerRefs } from "@/lib/store/app-store";
import { AlertCircle } from "lucide-react";

/**
 * IFC 3D viewer component — integrates ifc-lite Renderer with WebGPU.
 *
 * Camera controls:
 * - Left-click drag → orbit
 * - Right-click / middle-click / Shift+left drag → pan
 * - Scroll wheel → zoom (towards mouse)
 * - Click → pick element
 * - Ctrl/Cmd+click → toggle multi-select
 */
export function IfcViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<unknown>(null);
  const cameraRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const initRef = useRef(false);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);

  // Camera drag state — refs so we don't trigger re-renders
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

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
      console.log("[IfcViewer] Detecting WebGPU support...");
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        console.warn("[IfcViewer] navigator.gpu not available");
        setWebGPUSupported(false);
        return;
      }
      try {
        const gpu = navigator.gpu as GPU | undefined;
        if (!gpu) {
          console.warn("[IfcViewer] navigator.gpu is falsy");
          setWebGPUSupported(false);
          return;
        }
        const adapter = await gpu.requestAdapter();
        console.log("[IfcViewer] WebGPU adapter:", adapter ? "found" : "null");
        setWebGPUSupported(adapter !== null);
      } catch (err) {
        console.error("[IfcViewer] WebGPU detection error:", err);
        setWebGPUSupported(false);
      }
    })();
  }, []);

  // Initialize renderer once WebGPU is confirmed
  useEffect(() => {
    if (webGPUSupported !== true || !canvasRef.current || initRef.current)
      return;
    initRef.current = true;
    console.log("[IfcViewer] Initializing renderer...");

    let disposed = false;

    (async () => {
      try {
        console.log("[IfcViewer] Importing @ifc-lite/renderer...");
        const { Renderer } = await import("@ifc-lite/renderer");
        console.log("[IfcViewer] Renderer imported, creating instance...");
        if (disposed) return;

        const canvas = canvasRef.current!;
        const renderer = new Renderer(canvas);
        console.log("[IfcViewer] Calling renderer.init()...");
        await renderer.init();
        console.log("[IfcViewer] Renderer initialized successfully!");

        if (disposed) return;

        rendererRef.current = renderer;
        viewerRefs.renderer = renderer;
        viewerRefs.canvas = canvas;

        // Notify waiting upload zone that renderer is ready
        console.log("[IfcViewer] Signaling renderer ready to upload zone");
        viewerRefs.rendererReadyResolve?.();

        const camera = (renderer as any).camera;
        cameraRef.current = camera;

        // ----------------------------------------------------------
        // Camera controls: orbit, pan, zoom
        // ----------------------------------------------------------
        setupCameraControls(canvas, renderer, cameraRef, isDraggingRef, isPanningRef, lastMouseRef, didDragRef);

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

  // Handle click → pick (only if user didn't drag)
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If the user dragged the mouse, don't pick
      if (didDragRef.current) return;

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

  // Handle mouse move → hover (throttled, only when not dragging)
  const lastHoverRef = useRef(0);
  const handleMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Don't hover-pick while dragging camera
      if (isDraggingRef.current) return;

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
        style={{ touchAction: "none", cursor: "grab" }}
      />
      <LoadingOverlay />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera controls setup — orbit, pan, zoom
// ---------------------------------------------------------------------------

function setupCameraControls(
  canvas: HTMLCanvasElement,
  renderer: any,
  cameraRef: React.MutableRefObject<unknown>,
  isDraggingRef: React.MutableRefObject<boolean>,
  isPanningRef: React.MutableRefObject<boolean>,
  lastMouseRef: React.MutableRefObject<{ x: number; y: number }>,
  didDragRef: React.MutableRefObject<boolean>,
) {
  const camera = (renderer as any).camera;

  const DRAG_THRESHOLD = 4; // px — movement under this is a click, not a drag

  // Mouse down — start drag
  const onMouseDown = (e: MouseEvent) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    // Middle click (1), right click (2), or shift+left = pan
    isPanningRef.current = e.button === 1 || e.button === 2 || e.shiftKey;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = isPanningRef.current ? "move" : "grabbing";
  };

  // Mouse move — orbit or pan
  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;

    // Check if we've moved enough to consider it a drag
    if (!didDragRef.current && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      didDragRef.current = true;
    }

    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const cam = cameraRef.current as any;
    if (!cam) return;

    if (isPanningRef.current) {
      cam.pan(deltaX, deltaY);
    } else {
      cam.orbit(deltaX, deltaY);
    }

    renderer.render();
  };

  // Mouse up — stop drag
  const onMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
    canvas.style.cursor = "grab";
  };

  // Mouse leave — stop drag
  const onMouseLeave = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  // Scroll wheel — zoom towards mouse position
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();

    const cam = cameraRef.current as any;
    if (!cam) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    cam.zoom(e.deltaY, false, mouseX, mouseY, canvas.width, canvas.height);
    renderer.render();
  };

  // Prevent context menu on right-click
  const onContextMenu = (e: Event) => e.preventDefault();

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  canvas.style.cursor = "grab";
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
