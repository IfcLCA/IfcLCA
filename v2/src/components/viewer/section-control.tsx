"use client";

import { useState } from "react";
import { Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { viewerRefs } from "@/lib/store/app-store";

type SectionAxis = "down" | "front" | "side";

/**
 * Section plane control — clips the 3D model along an axis.
 * Positioned as a floating panel near the viewer.
 */
export function SectionControl() {
  const [enabled, setEnabled] = useState(false);
  const [axis, setAxis] = useState<SectionAxis>("down");
  const [position, setPosition] = useState(50);

  function applySection(a: SectionAxis, pos: number, on: boolean) {
    const r = viewerRefs.renderer as any;
    if (!r) return;

    r.render({
      sectionPlane: on
        ? { axis: a, position: pos, enabled: true }
        : { axis: "down", position: 100, enabled: false },
    });
  }

  function toggleSection() {
    const next = !enabled;
    setEnabled(next);
    applySection(axis, position, next);
  }

  function changeAxis(a: SectionAxis) {
    setAxis(a);
    if (enabled) applySection(a, position, true);
  }

  function changePosition(pos: number) {
    setPosition(pos);
    if (enabled) applySection(axis, pos, true);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={enabled ? "secondary" : "ghost"}
        size="sm"
        className={`h-7 gap-1 px-2 text-xs ${enabled ? "ring-1 ring-primary/30" : ""}`}
        onClick={toggleSection}
        title="Section plane"
      >
        <Scissors className="h-3.5 w-3.5" />
        Section
      </Button>

      {enabled && (
        <div className="flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
          {(["down", "front", "side"] as const).map((a) => (
            <button
              key={a}
              onClick={() => changeAxis(a)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                axis === a
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {a === "down" ? "Y" : a === "front" ? "Z" : "X"}
            </button>
          ))}
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => changePosition(Number(e.target.value))}
            className="h-1 w-20 accent-primary"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
            {position}%
          </span>
          <button
            onClick={() => {
              setEnabled(false);
              applySection(axis, position, false);
            }}
            className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
