"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { IfcViewer } from "@/components/viewer/ifc-viewer";
import { UploadZone } from "@/components/viewer/upload-zone";
import { ViewerToolbar } from "@/components/viewer/toolbar";
import { ContextPanel } from "@/components/panels/context-panel";
import { BottomPanel } from "@/components/panels/bottom-panel";
import type { projects, materials } from "@/db/schema";

type Project = typeof projects.$inferSelect;
type Material = typeof materials.$inferSelect;

interface ProjectClientProps {
  project: Project;
  materials: Material[];
}

export function ProjectClient({
  project,
  materials: serverMaterials,
}: ProjectClientProps) {
  const router = useRouter();
  const {
    parseResult,
    modelLoading,
    setProject,
    setMaterials,
    matchedCount,
    totalMaterialCount,
  } = useAppStore();

  useEffect(() => {
    setProject({
      id: project.id,
      name: project.name,
      preferredDataSource: project.preferredDataSource ?? "kbob",
    });
  }, [project, setProject]);

  // Hydrate store with server-side materials (match state, etc.)
  useEffect(() => {
    if (serverMaterials.length > 0) {
      const hydrated = serverMaterials.map((m) => ({
        name: m.name,
        totalVolume: m.totalVolume ?? 0,
        elementCount: 0,
        elementTypes: [] as string[],
        dbId: m.id,
        match: m.lcaMaterialId
          ? {
              lcaMaterialId: m.lcaMaterialId,
              source: m.matchSource ?? "",
              sourceId: m.matchSourceId ?? "",
              method: m.matchMethod ?? "manual",
              score: m.matchScore ?? 1,
            }
          : undefined,
      }));
      setMaterials(hydrated);
    }
  }, [serverMaterials, setMaterials]);

  const hasModel = parseResult !== null;
  const showViewer = hasModel || modelLoading;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">{project.name}</span>
          <Badge variant="outline" className="text-xs">
            {project.preferredDataSource ?? "kbob"}
          </Badge>
          {totalMaterialCount > 0 && (
            <Badge
              variant={
                matchedCount === totalMaterialCount
                  ? "matched"
                  : matchedCount > 0
                  ? "partial"
                  : "unmatched"
              }
              className="text-xs"
            >
              {matchedCount}/{totalMaterialCount} matched
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasModel && <ViewerToolbar />}
          <UserButton />
        </div>
      </header>

      {/* Main content */}
      {!showViewer ? (
        <div className="flex flex-1 items-center justify-center">
          <UploadZone projectId={project.id} />
        </div>
      ) : (
        <div className="project-layout flex-1">
          <div className="project-layout__viewer">
            <IfcViewer />
            {/* Show upload zone overlay if loading but no model yet */}
            {modelLoading && !hasModel && (
              <div className="absolute inset-0 flex items-center justify-center">
                <UploadZone projectId={project.id} />
              </div>
            )}
          </div>
          <div className="project-layout__context">
            <ContextPanel />
          </div>
          <div className="project-layout__bottom">
            <BottomPanel />
          </div>
        </div>
      )}
    </div>
  );
}
