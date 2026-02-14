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
} from "lucide-react";

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
  } = useAppStore();

  // Compute totals row
  const totals = useMemo(() => {
    let gwp = 0;
    let ubp = 0;
    let volume = 0;
    let hasAny = false;

    for (const mat of materials) {
      volume += mat.totalVolume;
      if (mat.matchedMaterial?.indicators) {
        gwp += mat.matchedMaterial.indicators.gwpTotal ?? 0;
        ubp += mat.matchedMaterial.indicators.ubp ?? 0;
        hasAny = true;
      }
    }

    return { gwp, ubp, volume, hasAny };
  }, [materials]);

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

    const rows = materials.map((mat) => [
      mat.name,
      mat.match ? "Matched" : "Unmatched",
      mat.totalVolume.toFixed(4),
      mat.density?.toFixed(0) ?? "",
      mat.matchedMaterial?.indicators?.gwpTotal?.toFixed(4) ?? "",
      mat.matchedMaterial?.indicators?.ubp?.toFixed(0) ?? "",
      mat.matchedMaterial?.name ?? "",
      mat.match?.source ?? "",
      mat.match?.method ?? "",
      mat.match?.score?.toFixed(2) ?? "",
    ]);

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
  }, [materials, project]);

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
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => {
                const isMatched = !!mat.match;
                const gwp = mat.matchedMaterial?.indicators?.gwpTotal;
                const ubp = mat.matchedMaterial?.indicators?.ubp;

                return (
                  <tr
                    key={mat.name}
                    className="border-b transition-colors hover:bg-accent/50"
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
                      <div className="flex items-center gap-1">
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
