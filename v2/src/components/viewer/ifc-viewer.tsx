"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useAppStore, viewerRefs } from "@/lib/store/app-store";
import { AlertCircle, X } from "lucide-react";
import { ColorLegend } from "./color-legend";
import {
  computeHeatmapColors,
  computeMatchStatusColors,
  computeTypeColors,
} from "@/lib/viewer/color-engine";
import type { IndicatorKey } from "@/types/lca";

/**
 * IFC 3D viewer component — integrates ifc-lite Renderer with WebGPU.
 *
 * Camera controls:
 * - Left-click drag → orbit
 * - Right-click / middle-click / Shift+left drag → pan
 * - Scroll wheel → zoom (towards mouse)
 * - Click → pick element
 * - Ctrl/Cmd+click → toggle multi-select
 *
 * 3D integration:
 * - Color overrides (heatmap, match status, element type)
 * - Element isolation (from chart clicks)
 * - Camera framing (zoom to isolated/selected elements)
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
    isolatedElementIds,
    colorMode,
    materials,
    selectElement,
    toggleElementSelection,
    setHoveredElement,
    deselectAll,
    isolateElements,
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
              renderFrame(rendererRef.current as any);
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

  // Subscribe to visibility/isolation changes and force re-render
  const visibilityByStorey = useAppStore((s) => s.visibilityByStorey);
  const visibilityByType = useAppStore((s) => s.visibilityByType);

  useEffect(() => {
    const r = rendererRef.current as any;
    if (!r) return;
    renderFrame(r);
  }, [selectedElementIds, isolatedElementIds, visibilityByStorey, visibilityByType]);

  // Apply color overrides when colorMode or materials change
  useEffect(() => {
    const r = rendererRef.current as any;
    if (!r || !parseResult) return;

    try {
      const scene = r.getScene?.();
      if (!scene) return;

      const gToE = viewerRefs.guidToExpressId;

      if (colorMode === "none") {
        scene.clearColorOverrides?.();
        r.render();
        return;
      }

      let colorMap;
      if (colorMode === "matchStatus") {
        colorMap = computeMatchStatusColors(parseResult.elements, materials, gToE);
      } else if (colorMode === "gwpTotal" || colorMode === "penreTotal" || colorMode === "ubp") {
        colorMap = computeHeatmapColors(parseResult.elements, colorMode as IndicatorKey, materials, gToE);
      } else if (colorMode === "elementType") {
        colorMap = computeTypeColors(parseResult.elements, gToE);
      }

      if (colorMap) {
        const device = r.getGPUDevice?.();
        const pipeline = r.getPipeline?.();
        if (device && pipeline) {
          scene.setColorOverrides(colorMap.overrides, device, pipeline);
        }
      }

      renderFrame(r);
    } catch (err) {
      console.warn("[IfcViewer] Color override failed:", err);
    }
  }, [colorMode, materials, parseResult]);

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
    const scene = r.getScene?.() ?? r.scene;
    if (scene) {
      const bounds = scene.getBounds();
      if (bounds) {
        const cam = cameraRef.current as any;
        if (cam?.zoomToFit) {
          cam.zoomToFit(bounds.min, bounds.max, 500);
        } else if (cam?.fitToBounds) {
          cam.fitToBounds(bounds.min, bounds.max);
        }
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
    <div ref={containerRef} className="viewer-container relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="h-full w-full"
        style={{ touchAction: "none", cursor: "grab" }}
      />
      <LoadingOverlay />
      <ColorLegend />
      <IsolationBanner />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Render frame helper — builds render options from current state
// ---------------------------------------------------------------------------

function renderFrame(r: any) {
  if (!r) return;

  const state = useAppStore.getState();

  // Build selected IDs
  const selectedIds = new Set<number>();
  for (const guid of state.selectedElementIds) {
    const eid = viewerRefs.guidToExpressId.get(guid);
    if (eid !== undefined) selectedIds.add(eid);
  }

  // Build hidden IDs from type visibility + storey visibility
  const hiddenIds = new Set<number>();
  const ds = viewerRefs.dataStore as any;
  if (ds?.entities) {
    for (const [type, visible] of Object.entries(state.visibilityByType)) {
      if (!visible) {
        const ids = ds.entities.getByType?.(type) ?? [];
        for (const id of ids) hiddenIds.add(id);
      }
    }
  }

  // Hide elements from hidden storeys
  if (state.parseResult) {
    for (const storey of state.parseResult.storeys) {
      if (state.visibilityByStorey[storey.name] === false) {
        for (const guid of storey.elementGuids) {
          const eid = viewerRefs.guidToExpressId.get(guid);
          if (eid !== undefined) hiddenIds.add(eid);
        }
      }
    }
  }

  // Build isolated IDs
  let isolatedIds: Set<number> | undefined;
  if (state.isolatedElementIds) {
    isolatedIds = new Set<number>();
    for (const guid of state.isolatedElementIds) {
      const eid = viewerRefs.guidToExpressId.get(guid);
      if (eid !== undefined) isolatedIds.add(eid);
    }
  }

  r.render({
    selectedIds: selectedIds.size > 0 ? selectedIds : undefined,
    hiddenIds: hiddenIds.size > 0 ? hiddenIds : undefined,
    isolatedIds: isolatedIds && isolatedIds.size > 0 ? isolatedIds : undefined,
  });
}

// ---------------------------------------------------------------------------
// Frame elements — zoom camera to fit a set of element GUIDs
// ---------------------------------------------------------------------------

export function frameElements(guids: Set<string>) {
  const r = viewerRefs.renderer as any;
  if (!r) return;

  const scene = r.getScene?.();
  if (!scene) return;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let found = false;

  for (const guid of guids) {
    const eid = viewerRefs.guidToExpressId.get(guid);
    if (eid === undefined) continue;
    const bbox = scene.getEntityBoundingBox(eid);
    if (!bbox) continue;
    found = true;
    minX = Math.min(minX, bbox.min.x);
    minY = Math.min(minY, bbox.min.y);
    minZ = Math.min(minZ, bbox.min.z);
    maxX = Math.max(maxX, bbox.max.x);
    maxY = Math.max(maxY, bbox.max.y);
    maxZ = Math.max(maxZ, bbox.max.z);
  }

  if (!found) return;

  const camera = r.getCamera?.() ?? (r as any).camera;
  if (!camera) return;

  if (camera.frameBounds) {
    camera.frameBounds({ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: maxZ }, 400);
  } else if (camera.zoomToFit) {
    camera.zoomToFit({ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: maxZ }, 400);
  }

  // Trigger continuous render during animation
  let frames = 0;
  function animRender() {
    r.render();
    frames++;
    if (frames < 30) requestAnimationFrame(animRender);
  }
  requestAnimationFrame(animRender);
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
  const DRAG_THRESHOLD = 4;

  const onMouseDown = (e: MouseEvent) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    isPanningRef.current = e.button === 1 || e.button === 2 || e.shiftKey;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = isPanningRef.current ? "move" : "grabbing";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;

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

  const onMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
    canvas.style.cursor = "grab";
  };

  const onMouseLeave = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

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

  const onContextMenu = (e: Event) => e.preventDefault();

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  canvas.style.cursor = "grab";
}

// ---------------------------------------------------------------------------
// Isolation banner — shows when elements are isolated, with "Show All"
// ---------------------------------------------------------------------------

function IsolationBanner() {
  const isolatedElementIds = useAppStore((s) => s.isolatedElementIds);
  const parseResult = useAppStore((s) => s.parseResult);
  const isolateElements = useAppStore((s) => s.isolateElements);

  if (!isolatedElementIds || isolatedElementIds.size === 0) return null;

  const total = parseResult?.elements.length ?? 0;

  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-md backdrop-blur-sm">
        <span className="text-muted-foreground">
          Showing {isolatedElementIds.size} of {total} elements
        </span>
        <button
          onClick={() => isolateElements(null)}
          className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Show All
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------

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
