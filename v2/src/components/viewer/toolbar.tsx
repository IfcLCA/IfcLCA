"use client";

import { Eye, Palette, BarChart3, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import type { ColorMode } from "@/types/lca";

const COLOR_MODES: { mode: ColorMode; label: string; icon: React.ReactNode }[] = [
  { mode: "matchStatus", label: "Match Status", icon: <Eye className="h-3.5 w-3.5" /> },
  { mode: "gwpTotal", label: "GWP", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { mode: "penreTotal", label: "PENRE", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { mode: "elementType", label: "Type", icon: <Layers className="h-3.5 w-3.5" /> },
];

export function ViewerToolbar() {
  const { colorMode, setColorMode } = useAppStore();

  return (
    <div className="flex items-center gap-1">
      <Palette className="mr-1 h-4 w-4 text-muted-foreground" />
      {COLOR_MODES.map(({ mode, label, icon }) => (
        <Button
          key={mode}
          variant={colorMode === mode ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setColorMode(mode)}
        >
          {icon}
          {label}
        </Button>
      ))}
    </div>
  );
}
