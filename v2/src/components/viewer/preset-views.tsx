"use client";

import { useState } from "react";
import { Compass, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { viewerRefs } from "@/lib/store/app-store";
import { renderFrame } from "./ifc-viewer";

const VIEWS = [
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
] as const;

type PresetView = (typeof VIEWS)[number]["id"];

/**
 * Preset view dropdown — switches camera to standard orthographic views.
 */
export function PresetViews() {
  const [open, setOpen] = useState(false);

  function applyView(view: PresetView) {
    const r = viewerRefs.renderer as any;
    if (!r) return;

    const camera = r.getCamera?.() ?? r.camera;
    const scene = r.getScene?.() ?? r.scene;
    if (!camera?.setPresetView) return;

    const bounds = scene?.getBounds?.();
    camera.setPresetView(view, bounds ?? undefined);

    // Render animation frames (preserving isolation/selection state)
    let frames = 0;
    function animRender() {
      renderFrame(r);
      frames++;
      if (frames < 20) requestAnimationFrame(animRender);
    }
    requestAnimationFrame(animRender);

    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setOpen(!open)}
      >
        <Compass className="h-3.5 w-3.5" />
        View
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => applyView(id)}
                className="flex w-full rounded-sm px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
