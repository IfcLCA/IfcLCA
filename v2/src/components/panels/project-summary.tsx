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

export function ProjectSummary() {
  const {
    project,
    materials,
    matchedCount,
    totalMaterialCount,
    parseResult,
    activeDataSource,
    updateMaterialMatch,
  } = useAppStore();

  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<string | null>(null);

  const matchPercentage =
    totalMaterialCount > 0
      ? Math.round((matchedCount / totalMaterialCount) * 100)
      : 0;

  // Compute emission totals from matched materials
  const emissions = useMemo(() => {
    const totals = { gwp: 0, ubp: 0, penre: 0 };
    const byCategory: Record<string, { gwp: number; ubp: number; penre: number }> = {};

    for (const mat of materials) {
      if (!mat.matchedMaterial?.indicators) continue;
      const ind = mat.matchedMaterial.indicators;
      const gwp = ind.gwpTotal ?? 0;
      const ubp = ind.ubp ?? 0;
      const penre = ind.penreTotal ?? 0;

      totals.gwp += gwp;
      totals.ubp += ubp;
      totals.penre += penre;

      const cat = mat.matchedMaterial.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { gwp: 0, ubp: 0, penre: 0 };
      byCategory[cat].gwp += gwp;
      byCategory[cat].ubp += ubp;
      byCategory[cat].penre += penre;
    }

    const sortedCategories = Object.entries(byCategory).sort(
      ([, a], [, b]) => Math.abs(b.gwp) - Math.abs(a.gwp)
    );

    return { totals, byCategory: sortedCategories };
  }, [materials]);

  // Auto-match all unmatched materials
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

      const res = await fetch("/api/materials/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          source: activeDataSource,
          materialNames: unmatched.map((m) => m.name),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAutoMatchResult(data.error || "Auto-match failed");
        return;
      }

      let matched = 0;
      let reapplied = 0;
      let auto = 0;
      for (const result of data.matches ?? []) {
        if (result.match && result.matchedMaterial) {
          updateMaterialMatch(result.materialName, result.match, result.matchedMaterial);
          matched++;
          if (result.match.method === "reapplied") reapplied++;
          else auto++;
        }
      }

      if (matched > 0) {
        const parts = [];
        if (reapplied > 0) parts.push(`${reapplied} reapplied`);
        if (auto > 0) parts.push(`${auto} auto`);
        setAutoMatchResult(
          `Matched ${matched}/${unmatched.length} (${parts.join(", ")})`
        );
      } else {
        setAutoMatchResult(
          `No automatic matches found for ${unmatched.length} materials`
        );
      }
    } catch {
      setAutoMatchResult("Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  }, [project, materials, activeDataSource, updateMaterialMatch]);

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
          {autoMatchResult && (
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
            Environmental Indicators (per unit)
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

              {/* Breakdown by category */}
              {emissions.byCategory.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    GWP by Category
                  </h5>
                  {emissions.byCategory.slice(0, 6).map(([cat, vals]) => {
                    const pct =
                      emissions.totals.gwp !== 0
                        ? Math.abs((vals.gwp / emissions.totals.gwp) * 100)
                        : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate text-muted-foreground">{cat}</span>
                          <span className="tabular-nums">{vals.gwp.toFixed(2)} kg CO₂-eq</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-green-600/70"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Matched materials have no indicator data yet. Try syncing the{" "}
                {activeDataSource.toUpperCase()} database.
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
