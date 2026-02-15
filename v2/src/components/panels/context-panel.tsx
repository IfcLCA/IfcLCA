"use client";

import { useAppStore } from "@/lib/store";
import { ProjectSummary } from "./project-summary";
import { ElementDetail } from "./element-detail";
import { MaterialMatch } from "./material-match";
import { UploadHistory } from "@/components/project/upload-history";
import { StoreyPanel } from "@/components/viewer/storey-panel";

/**
 * Right-side context panel — shows different content based on selection state:
 * - No selection → Project summary (emission totals, charts) + storey nav + upload history
 * - Element selected → Element details + its materials
 * - Material selected → Material matching interface
 */
export function ContextPanel() {
  const { contextPanelMode, project, parseResult } = useAppStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {contextPanelMode === "summary" && (
          <>
            <ProjectSummary />
            {parseResult && parseResult.storeys.length > 0 && (
              <div className="border-t px-4 py-3">
                <StoreyPanel />
              </div>
            )}
            {project && <UploadHistory projectId={project.id} />}
          </>
        )}
        {contextPanelMode === "element" && <ElementDetail />}
        {contextPanelMode === "material" && <MaterialMatch />}
      </div>
    </div>
  );
}
