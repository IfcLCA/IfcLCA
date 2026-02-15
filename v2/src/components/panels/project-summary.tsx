"use client";

import { useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Loader2,
  Leaf,
  Zap,
  Flame,
} from "lucide-react";
import { EmissionsChart } from "@/components/charts/emissions-chart";
import type { ChartDataRow } from "@/components/charts/emissions-chart";
import { groupByMaterial, groupByType } from "@/lib/viewer/element-groups";

export function ProjectSummary() {
  const {
    project,
    materials,
    matchedCount,
    totalMaterialCount,
    parseResult,
    activeDataSource,
    updateMaterialMatch,
    autoMatchProgress,
    setAutoMatchProgress,
  } = useAppStore();

  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<string | null>(null);

  const matchPercentage =
    totalMaterialCount > 0
      ? Math.round((matchedCount / totalMaterialCount) * 100)
      : 0;

  // Compute emission totals: volume × density × indicator_factor
  const emissions = useMemo(() => {
    const totals = { gwp: 0, ubp: 0, penre: 0 };
    const byCategory: Record<string, { gwp: number; ubp: number; penre: number }> = {};
    const byMaterial: Array<{ name: string; gwp: number; ubp: number; penre: number }> = [];

    for (const mat of materials) {
      if (!mat.matchedMaterial?.indicators) continue;
      const vol = mat.totalVolume ?? 0;
      const density = mat.density ?? 0;
      if (vol <= 0 || density <= 0) continue;

      const mass = vol * density;
      const ind = mat.matchedMaterial.indicators;
      const gwp = (ind.gwpTotal ?? 0) * mass;
      const ubp = (ind.ubp ?? 0) * mass;
      const penre = (ind.penreTotal ?? 0) * mass;

      totals.gwp += gwp;
      totals.ubp += ubp;
      totals.penre += penre;

      byMaterial.push({ name: mat.name, gwp, ubp, penre });

      const cat = mat.matchedMaterial.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { gwp: 0, ubp: 0, penre: 0 };
      byCategory[cat].gwp += gwp;
      byCategory[cat].ubp += ubp;
      byCategory[cat].penre += penre;
    }

    const sortedCategories = Object.entries(byCategory).sort(
      ([, a], [, b]) => Math.abs(b.gwp) - Math.abs(a.gwp)
    );

    const sortedMaterials = byMaterial.sort(
      (a, b) => Math.abs(b.gwp) - Math.abs(a.gwp)
    );

    return { totals, byCategory: sortedCategories, byMaterial: sortedMaterials };
  }, [materials]);

  // Auto-match all unmatched materials via SSE streaming
  const handleAutoMatch = useCallback(async () => {
    if (!project) return;
    setAutoMatching(true);
    setAutoMatchResult(null);

    try {
      const unmatched = materials.filter((m) => !m.match);
      if (unmatched.length === 0) {
        setAutoMatchResult("All materials already matched!");
        return;
      }

      const total = unmatched.length;
      setAutoMatchProgress({
        phase: "matching",
        matched: 0,
        total,
        message: `Matching 0/${total} materials...`,
      });

      const res = await fetch("/api/materials/auto-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          projectId: project.id,
          source: activeDataSource,
          materialNames: unmatched.map((m) => m.name),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setAutoMatchResult(data.error || "Auto-match failed");
        setAutoMatchProgress({ phase: "idle", matched: 0, total: 0, message: "" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let matched = 0;
      let reapplied = 0;
      let auto = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);
            if (event.error) continue;

            const r = event.result;
            if (r?.match && r?.matchedMaterial) {
              updateMaterialMatch(r.materialName, r.match, r.matchedMaterial);
              matched++;
              if (r.match.method === "reapplied") reapplied++;
              else auto++;
            }
            setAutoMatchProgress({
              phase: "matching",
              matched: event.matched,
              total: event.total,
              message: `Matching ${event.matched}/${event.total} materials...`,
            });
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      if (matched > 0) {
        const parts = [];
        if (reapplied > 0) parts.push(`${reapplied} reapplied`);
        if (auto > 0) parts.push(`${auto} auto`);
        const msg = `Matched ${matched}/${total} (${parts.join(", ")})`;
        setAutoMatchResult(msg);
        setAutoMatchProgress({ phase: "done", matched, total, message: msg });
      } else {
        const msg = `No automatic matches found for ${total} materials`;
        setAutoMatchResult(msg);
        setAutoMatchProgress({ phase: "done", matched: 0, total, message: msg });
      }

      setTimeout(() => {
        const { autoMatchProgress: p } = useAppStore.getState();
        if (p.phase === "done") {
          setAutoMatchProgress({ phase: "idle", matched: 0, total: 0, message: "" });
        }
      }, 8000);
    } catch {
      setAutoMatchResult("Auto-match failed");
      setAutoMatchProgress({ phase: "idle", matched: 0, total: 0, message: "" });
    } finally {
      setAutoMatching(false);
    }
  }, [project, materials, activeDataSource, updateMaterialMatch, setAutoMatchProgress]);

  // Pre-build element group lookups for chart → 3D interaction
  const materialGroups = useMemo(() => {
    if (!parseResult) return undefined;
    return groupByMaterial(parseResult.elements);
  }, [parseResult]);

  const typeGroups = useMemo(() => {
    if (!parseResult) return undefined;
    return groupByType(parseResult.elements);
  }, [parseResult]);

  const hasEmissions =
    matchedCount > 0 &&
    (emissions.totals.gwp !== 0 || emissions.totals.ubp !== 0 || emissions.totals.penre !== 0);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Project Summary
        </h3>
        {project && <p className="mt-1 text-lg font-medium">{project.name}</p>}
      </div>

      {/* Match progress */}
      {totalMaterialCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Material Matching</span>
            <span className="font-medium">
              {matchedCount}/{totalMaterialCount}
            </span>
          </div>
          <Progress value={matchPercentage} className="h-2" />
          <div className="flex gap-2">
            <Badge variant="matched" className="text-xs">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {matchedCount} matched
            </Badge>
            {totalMaterialCount - matchedCount > 0 && (
              <Badge variant="unmatched" className="text-xs">
                <AlertCircle className="mr-1 h-3 w-3" />
                {totalMaterialCount - matchedCount} unmatched
              </Badge>
            )}
          </div>

          {/* Auto-match button */}
          {matchedCount < totalMaterialCount && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleAutoMatch}
              disabled={autoMatching}
            >
              {autoMatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Auto-match unmatched materials
            </Button>
          )}
          {/* Auto-match progress (from upload or button) */}
          {autoMatchProgress.phase === "matching" && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-muted-foreground">{autoMatchProgress.message}</span>
            </div>
          )}
          {autoMatchProgress.phase === "done" && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span className="text-green-700 dark:text-green-400">{autoMatchProgress.message}</span>
            </div>
          )}
          {autoMatchResult && autoMatchProgress.phase === "idle" && (
            <p className="text-xs text-muted-foreground">{autoMatchResult}</p>
          )}
        </div>
      )}

      {/* Model stats */}
      {parseResult && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Model
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Elements" value={parseResult.stats.elementCount.toString()} />
            <StatCard label="Materials" value={parseResult.stats.materialCount.toString()} />
            <StatCard label="Storeys" value={parseResult.storeys.length.toString()} />
            <StatCard label="Schema" value={parseResult.projectInfo.schema} />
          </div>
        </div>
      )}

      {/* Emission totals */}
      {matchedCount > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Environmental Impact
          </h4>

          {hasEmissions ? (
            <>
              <div className="grid gap-3">
                <IndicatorCard
                  icon={<Leaf className="h-4 w-4" />}
                  label="GWP Total"
                  value={emissions.totals.gwp}
                  unit="kg CO₂-eq"
                  colorClass="text-green-600"
                />
                <IndicatorCard
                  icon={<Flame className="h-4 w-4" />}
                  label="UBP Total"
                  value={emissions.totals.ubp}
                  unit="UBP"
                  colorClass="text-orange-600"
                />
                <IndicatorCard
                  icon={<Zap className="h-4 w-4" />}
                  label="PENRE Total"
                  value={emissions.totals.penre}
                  unit="MJ"
                  colorClass="text-blue-600"
                />
              </div>

              {/* Relative emissions per m²·a */}
              {project?.areaValue && project.areaValue > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Relative (per m²·a)
                  </h5>
                  <div className="grid gap-2">
                    {(() => {
                      const area = project.areaValue!;
                      const amort = project.amortization ?? 50;
                      const divisor = area * amort;
                      return (
                        <>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">GWP</span>
                            <span className="font-medium tabular-nums">
                              {(emissions.totals.gwp / divisor).toFixed(2)} kg CO₂-eq/m²·a
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">PENRE</span>
                            <span className="font-medium tabular-nums">
                              {(emissions.totals.penre / divisor).toFixed(2)} MJ/m²·a
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">UBP</span>
                            <span className="font-medium tabular-nums">
                              {(emissions.totals.ubp / divisor).toFixed(0)} UBP/m²·a
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {project.areaType ?? "Area"}: {area.toLocaleString()} m² · {amort} years
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Chart: by material — click bar to isolate elements in 3D */}
              {emissions.byMaterial.length > 0 && (
                <EmissionsChart
                  data={emissions.byMaterial}
                  title="By Material"
                  elementGroups={materialGroups}
                />
              )}

              {/* Chart: by category */}
              {emissions.byCategory.length > 0 && (
                <EmissionsChart
                  data={emissions.byCategory.map(([name, vals]) => ({
                    name,
                    ...vals,
                  }))}
                  title="By Category"
                />
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Match materials and ensure volumes are available to see environmental impact.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function IndicatorCard({
  icon,
  label,
  value,
  unit,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className={colorClass}>{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">
          {Math.abs(value) >= 1000
            ? value.toFixed(0)
            : Math.abs(value) >= 1
            ? value.toFixed(2)
            : value.toFixed(4)}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}
