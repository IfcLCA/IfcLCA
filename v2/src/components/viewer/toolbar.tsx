"use client";

import { Eye, Palette, BarChart3, Layers, Zap, RotateCcw, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { frameElements } from "./ifc-viewer";
import type { ColorMode } from "@/types/lca";

const COLOR_MODES: { mode: ColorMode; label: string; icon: React.ReactNode }[] = [
  { mode: "matchStatus", label: "Match", icon: <Eye className="h-3.5 w-3.5" /> },
  { mode: "gwpTotal", label: "GWP", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { mode: "penreTotal", label: "PENRE", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { mode: "ubp", label: "UBP", icon: <Zap className="h-3.5 w-3.5" /> },
  { mode: "elementType", label: "Type", icon: <Layers className="h-3.5 w-3.5" /> },
];

export function ViewerToolbar() {
  const { colorMode, setColorMode, selectedElementIds } = useAppStore();

  const hasSelection = selectedElementIds.size > 0;

  return (
    <div className="flex items-center gap-1">
      <Palette className="mr-1 h-4 w-4 text-muted-foreground" />
      {COLOR_MODES.map(({ mode, label, icon }) => (
        <Button
          key={mode}
          variant={colorMode === mode ? "secondary" : "ghost"}
          size="sm"
          className={`h-7 gap-1 px-2 text-xs ${
            colorMode === mode ? "ring-1 ring-primary/30" : ""
          }`}
          onClick={() => setColorMode(colorMode === mode ? "none" : mode)}
        >
          {icon}
          {label}
        </Button>
      ))}
      {colorMode !== "none" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => setColorMode("none")}
          title="Reset colors"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
      {hasSelection && (
        <>
          <span className="mx-0.5 text-muted-foreground/30">|</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => frameElements(selectedElementIds)}
            title="Frame selection in 3D"
          >
            <Focus className="h-3.5 w-3.5" />
            Frame
          </Button>
        </>
      )}
    </div>
  );
}
