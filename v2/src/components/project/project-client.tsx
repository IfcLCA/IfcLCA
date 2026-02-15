"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Building2, ArrowLeft, Database, ChevronDown, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { IfcViewer } from "@/components/viewer/ifc-viewer";
import { UploadZone } from "@/components/viewer/upload-zone";
import { ViewerToolbar } from "@/components/viewer/toolbar";
import { ContextPanel } from "@/components/panels/context-panel";
import { BottomPanel } from "@/components/panels/bottom-panel";
import type { projects, materials, lcaMaterials } from "@/db/schema";
import type { MatchMethod, NormalizedMaterial, IndicatorValues } from "@/types/lca";

type Project = typeof projects.$inferSelect;
type Material = typeof materials.$inferSelect;
type LCAMaterial = typeof lcaMaterials.$inferSelect;

interface ProjectClientProps {
  project: Project;
  materials: Material[];
  lcaMaterials?: LCAMaterial[];
}

export function ProjectClient({
  project,
  materials: serverMaterials,
  lcaMaterials: serverLcaMaterials = [],
}: ProjectClientProps) {
  const router = useRouter();
  const {
    parseResult,
    modelLoading,
    setProject,
    setMaterials,
    setParseResult,
    setModelLoading,
    setModelError,
    setLoadProgress,
    matchedCount,
    totalMaterialCount,
    materials: storeMaterials,
    activeDataSource,
    setActiveDataSource,
    clearAllMatches,
  } = useAppStore();
  const [dsOpen, setDsOpen] = useState(false);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);
  const [pendingDataSource, setPendingDataSource] = useState<string | null>(null);

  useEffect(() => {
    setProject({
      id: project.id,
      name: project.name,
      preferredDataSource: project.preferredDataSource ?? "kbob",
    });
  }, [project, setProject]);

  // Hydrate store with server-side materials (match state + LCA indicators)
  useEffect(() => {
    if (serverMaterials.length > 0) {
      // Build lookup: lcaMaterialId → LCA material row
      const lcaMap = new Map<string, LCAMaterial>();
      for (const lca of serverLcaMaterials) {
        lcaMap.set(lca.id, lca);
      }

      const hydrated = serverMaterials.map((m) => {
        const lcaRow = m.lcaMaterialId ? lcaMap.get(m.lcaMaterialId) : undefined;

        // Build NormalizedMaterial with indicators if LCA data exists
        const matchedMaterial: NormalizedMaterial | undefined = lcaRow
          ? {
              id: lcaRow.id,
              sourceId: lcaRow.sourceId,
              source: lcaRow.source,
              name: lcaRow.name,
              nameOriginal: lcaRow.nameOriginal ?? undefined,
              category: lcaRow.category ?? "Uncategorized",
              categoryOriginal: lcaRow.categoryOriginal ?? undefined,
              density: lcaRow.density,
              unit: lcaRow.unit ?? "kg",
              indicators: {
                gwpTotal: lcaRow.gwpTotal,
                gwpFossil: lcaRow.gwpFossil,
                gwpBiogenic: lcaRow.gwpBiogenic,
                gwpLuluc: lcaRow.gwpLuluc,
                penreTotal: lcaRow.penreTotal,
                pereTotal: lcaRow.pereTotal,
                ap: lcaRow.ap,
                odp: lcaRow.odp,
                pocp: lcaRow.pocp,
                adpMineral: lcaRow.adpMineral,
                adpFossil: lcaRow.adpFossil,
                ubp: lcaRow.ubp,
              } as IndicatorValues,
              metadata: {
                version: lcaRow.version ?? "unknown",
                lastSynced: lcaRow.lastSynced,
                validUntil: lcaRow.validUntil ?? undefined,
                scope: lcaRow.scope ?? undefined,
                standard: lcaRow.standard ?? undefined,
              },
            }
          : undefined;

        return {
          name: m.name,
          totalVolume: m.totalVolume ?? 0,
          elementCount: 0,
          elementTypes: [] as string[],
          dbId: m.id,
          density: lcaRow?.density ?? undefined,
          indicators: matchedMaterial?.indicators,
          matchedMaterial,
          match: m.lcaMaterialId
            ? {
                lcaMaterialId: m.lcaMaterialId,
                source: m.matchSource ?? "",
                sourceId: m.matchSourceId ?? "",
                method: (m.matchMethod ?? "manual") as MatchMethod,
                score: m.matchScore ?? 1,
                matchedAt: m.matchedAt ?? new Date(),
              }
            : undefined,
        };
      });
      setMaterials(hydrated);
    }
  }, [serverMaterials, serverLcaMaterials, setMaterials]);

  // Auto-load cached IFC from IndexedDB on revisit
  useEffect(() => {
    if (autoLoadAttempted || parseResult || modelLoading) return;
    setAutoLoadAttempted(true);

    (async () => {
      try {
        const { loadIfcFile: loadCachedFile } = await import("@/lib/ifc/cache");
        const cached = await loadCachedFile(project.id);
        if (!cached) return;

        console.log("[ProjectClient] Found cached IFC:", cached.fileName);
        setModelLoading(true);

        const { viewerRefs } = await import("@/lib/store/app-store");

        // Wait for renderer
        if (!viewerRefs.renderer) {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Renderer timeout")), 15_000)
          );
          await Promise.race([viewerRefs.rendererReady, timeout]);
        }
        if (!viewerRefs.renderer) return;

        const { loadIfcFile: loadIfc } = await import("@/lib/ifc/loader");
        const buffer = new Uint8Array(cached.buffer);

        const result = await loadIfc(buffer, viewerRefs.renderer as any, (progress) => {
          setLoadProgress(progress);
        });

        viewerRefs.dataStore = result.dataStore;
        viewerRefs.coordinateInfo = result.coordinateInfo;

        // Build expressId ↔ GUID mappings
        const dataStore = result.dataStore as any;
        if (dataStore?.entities) {
          const { extractEntityAttributesOnDemand } = await import("@ifc-lite/parser");
          const entities = dataStore.entities;
          for (let i = 0; i < entities.expressId.length; i++) {
            const expressId = entities.expressId[i];
            const attrs = extractEntityAttributesOnDemand(dataStore, expressId);
            if (attrs.globalId) {
              viewerRefs.expressIdToGuid.set(expressId, attrs.globalId);
              viewerRefs.guidToExpressId.set(attrs.globalId, expressId);
            }
          }
        }

        setParseResult(result.parseResult);
        console.log("[ProjectClient] Cached IFC loaded successfully");
      } catch (err) {
        console.warn("[ProjectClient] Auto-load from cache failed:", err);
        setModelLoading(false);
      }
    })();
  }, [autoLoadAttempted, parseResult, modelLoading, project.id, setParseResult, setModelLoading, setModelError, setLoadProgress]);

  const hasModel = parseResult !== null;
  const showViewer = hasModel || modelLoading;

  async function handleDataSourceSwitch(newSource: string) {
    if (newSource === activeDataSource) return;

    // If there are matched materials, ask for confirmation
    if (matchedCount > 0) {
      setPendingDataSource(newSource);
      return;
    }

    applyDataSourceSwitch(newSource);
  }

  async function applyDataSourceSwitch(newSource: string) {
    setPendingDataSource(null);

    // Clear all matches in DB
    if (matchedCount > 0 && project.id) {
      try {
        await fetch(`/api/materials/match?projectId=${project.id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to clear matches:", err);
      }
    }

    // Clear local state
    clearAllMatches();

    // Update data source
    setActiveDataSource(newSource);

    // Persist to project
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredDataSource: newSource }),
      });
    } catch (err) {
      console.error("Failed to persist data source:", err);
    }
  }

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
          {/* Data source selector */}
          <div className="relative">
            <button
              onClick={() => setDsOpen(!dsOpen)}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
            >
              <Database className="h-3 w-3" />
              {activeDataSource.toUpperCase()}
              <ChevronDown className="h-3 w-3" />
            </button>
            {dsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDsOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                  {[
                    { id: "kbob", label: "KBOB", desc: "Swiss (CH)" },
                    { id: "oekobaudat", label: "Ökobaudat", desc: "German (DE)" },
                  ].map((ds) => (
                    <button
                      key={ds.id}
                      onClick={() => {
                        handleDataSourceSwitch(ds.id);
                        setDsOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                        activeDataSource === ds.id ? "bg-accent" : ""
                      }`}
                    >
                      <span className="font-medium">{ds.label}</span>
                      <span className="text-xs text-muted-foreground">{ds.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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

      {/* Main content — IfcViewer always mounted so WebGPU renderer initializes early */}
      {showViewer ? (
        <div className="project-layout flex-1">
          <div className="project-layout__viewer relative">
            <IfcViewer />
            {!hasModel && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
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
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          {/* Hidden viewer to pre-init WebGPU renderer in background */}
          <div className="absolute inset-0 -z-10 opacity-0 pointer-events-none">
            <IfcViewer />
          </div>
          <UploadZone projectId={project.id} />
        </div>
      )}

      {/* Confirmation dialog: switching data source clears all matches */}
      {pendingDataSource && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setPendingDataSource(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <h3 className="font-semibold">Switch data source?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switching to{" "}
                  <strong>{pendingDataSource === "kbob" ? "KBOB" : "Ökobaudat"}</strong>{" "}
                  will remove all {matchedCount} existing material{matchedCount !== 1 ? " mappings" : " mapping"}.
                  This cannot be undone.
                </p>
                <div className="mt-4 flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setPendingDataSource(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => applyDataSourceSwitch(pendingDataSource)}>
                    Switch &amp; clear mappings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
