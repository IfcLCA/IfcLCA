"use client";

import { useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
  X,
  User,
  RotateCcw,
  Sparkles,
  Eye,
} from "lucide-react";
import type { MatchMethod } from "@/types/lca";
import { frameElements } from "@/components/viewer/ifc-viewer";
import { groupByMaterial } from "@/lib/viewer/element-groups";

/**
 * Bottom panel — materials table showing all materials
 * with their match status, volumes, and indicators.
 */
export function BottomPanel() {
  const {
    materials,
    bottomPanelOpen,
    setBottomPanelOpen,
    setSelectedMaterial,
    project,
    updateMaterialMatch,
    parseResult,
    selectedElementIds,
    isolateElements,
  } = useAppStore();

  // Compute calculated emissions: volume × density × factor per material
  const materialEmissions = useMemo(() => {
    return materials.map((mat) => {
      const vol = mat.totalVolume ?? 0;
      const density = mat.density ?? 0;
      const indicators = mat.matchedMaterial?.indicators;
      if (!indicators || density <= 0 || vol <= 0) {
        return { gwp: null as number | null, ubp: null as number | null };
      }
      const mass = vol * density;
      return {
        gwp: indicators.gwpTotal != null ? mass * indicators.gwpTotal : null,
        ubp: indicators.ubp != null ? mass * indicators.ubp : null,
      };
    });
  }, [materials]);

  // Compute totals row
  const totals = useMemo(() => {
    let gwp = 0;
    let ubp = 0;
    let volume = 0;
    let hasAny = false;

    for (let i = 0; i < materials.length; i++) {
      volume += materials[i].totalVolume;
      const em = materialEmissions[i];
      if (em.gwp != null || em.ubp != null) {
        gwp += em.gwp ?? 0;
        ubp += em.ubp ?? 0;
        hasAny = true;
      }
    }

    return { gwp, ubp, volume, hasAny };
  }, [materials, materialEmissions]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = [
      "Material",
      "Status",
      "Volume (m³)",
      "Density (kg/m³)",
      "GWP (kg CO₂-eq)",
      "UBP",
      "Matched To",
      "Source",
      "Match Method",
      "Match Score",
    ];

    const rows = materials.map((mat, i) => {
      const em = materialEmissions[i];
      return [
        mat.name,
        mat.match ? "Matched" : "Unmatched",
        mat.totalVolume.toFixed(4),
        mat.density?.toFixed(0) ?? "",
        em?.gwp?.toFixed(4) ?? "",
        em?.ubp?.toFixed(0) ?? "",
        mat.matchedMaterial?.name ?? "",
        mat.match?.source ?? "",
        mat.match?.method ?? "",
        mat.match?.score?.toFixed(2) ?? "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "materials"}-lca-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [materials, materialEmissions, project]);

  // Unmatch a material
  const handleUnmatch = useCallback(
    async (materialName: string) => {
      if (!project) return;

      // Optimistic: clear locally
      updateMaterialMatch(materialName, null, null);

      // Persist to server
      try {
        await fetch("/api/materials/unmatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            materialName,
          }),
        });
      } catch (err) {
        console.error("Failed to unmatch:", err);
      }
    },
    [project, updateMaterialMatch]
  );

  // Build material → element GUID mapping for "Show in 3D"
  const materialElementMap = useMemo(() => {
    if (!parseResult) return new Map<string, Set<string>>();
    return groupByMaterial(parseResult.elements);
  }, [parseResult]);

  // Materials used by selected elements (for row highlighting)
  const selectedMaterialNames = useMemo(() => {
    if (!selectedElementIds || selectedElementIds.size === 0 || !parseResult) return new Set<string>();
    const names = new Set<string>();
    for (const guid of selectedElementIds) {
      const el = parseResult.elements.find((e) => e.guid === guid);
      if (el) {
        for (const mat of el.materials) names.add(mat.name);
      }
    }
    return names;
  }, [selectedElementIds, parseResult]);

  // Sort: matched first (manual → reapplied → auto by score desc), then unmatched
  const sortedMaterials = useMemo(() => {
    const methodPriority: Record<string, number> = {
      manual: 0,
      exact: 1,
      case_insensitive: 2,
      reapplied: 3,
      fuzzy: 4,
      classification: 5,
      auto: 6,
    };
    return [...materials].sort((a, b) => {
      // Matched before unmatched
      if (a.match && !b.match) return -1;
      if (!a.match && b.match) return 1;
      if (!a.match && !b.match) return a.name.localeCompare(b.name);
      // Both matched: sort by method priority, then score desc
      const aPri = methodPriority[a.match!.method] ?? 99;
      const bPri = methodPriority[b.match!.method] ?? 99;
      if (aPri !== bPri) return aPri - bPri;
      return (b.match!.score ?? 0) - (a.match!.score ?? 0);
    });
  }, [materials]);

  if (materials.length === 0) return null;

  const matchedCount = materials.filter((m) => m.match).length;

  return (
    <div>
      {/* Toggle header */}
      <button
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-accent"
        onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
      >
        <div className="flex items-center gap-3">
          <span>Materials ({materials.length})</span>
          <span className="text-xs text-muted-foreground">
            {matchedCount}/{materials.length} matched
          </span>
        </div>
        <div className="flex items-center gap-2">
          {bottomPanelOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleExportCSV();
              }}
            >
              <Download className="mr-1 h-3 w-3" />
              CSV
            </Button>
          )}
          {bottomPanelOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Table */}
      {bottomPanelOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Material</th>
                <th className="px-4 py-2 text-right">Volume (m³)</th>
                <th className="px-4 py-2 text-right">Density (kg/m³)</th>
                <th className="px-4 py-2 text-right">GWP (kg CO₂-eq)</th>
                <th className="px-4 py-2 text-right">UBP</th>
                <th className="px-4 py-2">Matched To</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedMaterials.map((mat) => {
                const isMatched = !!mat.match;
                const origIdx = materials.indexOf(mat);
                const em = origIdx >= 0 ? materialEmissions[origIdx] : null;
                const gwp = em?.gwp;
                const ubp = em?.ubp;
                const isHighlighted = selectedMaterialNames.has(mat.name);

                return (
                  <tr
                    key={mat.name}
                    className={`border-b transition-colors hover:bg-accent/50 ${
                      isHighlighted ? "bg-primary/10 ring-1 ring-inset ring-primary/20" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      {isMatched ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{mat.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {mat.totalVolume.toFixed(4)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {mat.density?.toFixed(0) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {gwp != null ? gwp.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {ubp != null ? ubp.toFixed(0) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {mat.matchedMaterial ? (
                        <div className="flex items-center gap-1">
                          <span className="max-w-[200px] truncate text-xs">
                            {mat.matchedMaterial.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {mat.match!.source}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not matched
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isMatched && (
                        <MatchMethodBadge
                          method={mat.match!.method}
                          score={mat.match!.score}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {materialElementMap.has(mat.name) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            title="Show in 3D"
                            onClick={() => {
                              const guids = materialElementMap.get(mat.name);
                              if (guids) {
                                isolateElements(guids);
                                frameElements(guids);
                              }
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        {isMatched && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Remove match"
                            onClick={() => handleUnmatch(mat.name)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setSelectedMaterial(mat.name)}
                        >
                          {isMatched ? "Edit" : "Match"}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals row */}
            {totals.hasAny && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {totals.volume.toFixed(4)}
                  </td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {totals.gwp.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {totals.ubp.toFixed(0)}
                  </td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match method badge — visual confidence indicator
// ---------------------------------------------------------------------------

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: typeof User; className: string; tip: string }
> = {
  manual: {
    label: "Manual",
    icon: User,
    className: "border-green-600/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    tip: "Manually matched by user",
  },
  exact: {
    label: "Exact",
    icon: CheckCircle2,
    className: "border-green-600/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    tip: "Exact name match",
  },
  case_insensitive: {
    label: "Exact",
    icon: CheckCircle2,
    className: "border-green-600/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    tip: "Case-insensitive name match",
  },
  reapplied: {
    label: "Reapplied",
    icon: RotateCcw,
    className: "border-blue-600/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    tip: "Auto-applied from a previous manual mapping",
  },
  fuzzy: {
    label: "Auto",
    icon: Sparkles,
    className: "border-amber-600/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    tip: "Matched by similarity algorithm",
  },
  classification: {
    label: "Auto",
    icon: Sparkles,
    className: "border-amber-600/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    tip: "Matched by classification code",
  },
  auto: {
    label: "Auto",
    icon: Sparkles,
    className: "border-amber-600/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    tip: "Matched by algorithm",
  },
};

function MatchMethodBadge({
  method,
  score,
}: {
  method: MatchMethod;
  score: number;
}) {
  const config = METHOD_CONFIG[method] ?? METHOD_CONFIG.auto;
  const Icon = config.icon;
  const pct = Math.round(score * 100);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
      title={`${config.tip} (${pct}% confidence)`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      <span className="text-[10px] opacity-70">{pct}%</span>
    </span>
  );
}
