"use client";

import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
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
  } = useAppStore();

  if (materials.length === 0) return null;

  return (
    <div>
      {/* Toggle header */}
      <button
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-accent"
        onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
      >
        <span>
          Materials ({materials.length})
        </span>
        {bottomPanelOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
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
                const gwp = mat.indicators?.gwpTotal;
                const ubp = mat.indicators?.ubp;

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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSelectedMaterial(mat.name)}
                      >
                        {isMatched ? "Edit" : "Match"}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
