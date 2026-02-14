"use client";

import { useAppStore } from "@/lib/store";
import { ProjectSummary } from "./project-summary";
import { ElementDetail } from "./element-detail";
import { MaterialMatch } from "./material-match";

/**
 * Right-side context panel — shows different content based on selection state:
 * - No selection → Project summary (emission totals, charts)
 * - Element selected → Element details + its materials
 * - Material selected → Material matching interface
 */
export function ContextPanel() {
  const { contextPanelMode } = useAppStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {contextPanelMode === "summary" && <ProjectSummary />}
        {contextPanelMode === "element" && <ElementDetail />}
        {contextPanelMode === "material" && <MaterialMatch />}
      </div>
    </div>
  );
}
