"use client";

import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, CheckCircle2, AlertCircle } from "lucide-react";

export function ProjectSummary() {
  const { project, materials, matchedCount, totalMaterialCount, parseResult } =
    useAppStore();

  const matchPercentage =
    totalMaterialCount > 0
      ? Math.round((matchedCount / totalMaterialCount) * 100)
      : 0;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Project Summary
        </h3>
        {project && (
          <p className="mt-1 text-lg font-medium">{project.name}</p>
        )}
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
        </div>
      )}

      {/* Model stats */}
      {parseResult && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Model
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Elements"
              value={parseResult.stats.elementCount.toString()}
            />
            <StatCard
              label="Materials"
              value={parseResult.stats.materialCount.toString()}
            />
            <StatCard
              label="Storeys"
              value={parseResult.storeys.length.toString()}
            />
            <StatCard
              label="Schema"
              value={parseResult.projectInfo.schema}
            />
          </div>
        </div>
      )}

      {/* Emission totals placeholder */}
      {matchedCount > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Emissions
          </h4>
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Emission totals will appear here once materials are matched
            </p>
          </div>
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
