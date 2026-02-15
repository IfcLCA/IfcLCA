"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileJson, Loader2, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

/**
 * Export dialog/button — downloads LCA results in various formats.
 *
 * Formats:
 *  - JSON (IFC property set format): element GUIDs + CPset_IfcLCA properties
 *  - CSV: flat table of all materials with calculated emissions
 */
export function ExportButton() {
  const { project } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function handleExportJSON() {
    if (!project) return;
    setExporting(true);
    setExportDone(false);

    try {
      const res = await fetch(`/api/projects/${project.id}/export`);
      if (!res.ok) {
        console.error("Export failed:", await res.text());
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/[^a-zA-Z0-9-_]/g, "_")}-lca-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExportJSON}
      disabled={exporting || !project}
      className="h-8 gap-1.5 text-xs"
    >
      {exporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : exportDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {exportDone ? "Downloaded" : "Export"}
    </Button>
  );
}
