"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Database,
  RefreshCw,
  AlertCircle,
  X,
  Layers,
} from "lucide-react";
import type { NormalizedMaterial } from "@/types/lca";

/**
 * Material matching panel — search and assign LCA materials
 * to an IFC material name. Supports single and batch matching.
 */
export function MaterialMatch() {
  const {
    selectedMaterialName,
    batchMatchMaterials,
    materials,
    activeDataSource,
    project,
    setSelectedMaterial,
    setBatchMatchMaterials,
    setContextPanelMode,
    updateMaterialMatch,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const isBatchMode = batchMatchMaterials.length > 1;
  const batchNames = isBatchMode ? batchMatchMaterials : [];

  const currentMaterial = materials.find(
    (m) => m.name === selectedMaterialName
  );

  const [searchError, setSearchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        source: activeDataSource,
      });
      console.log(`[search:client] Searching "${searchQuery}" in ${activeDataSource}`);
      const res = await fetch(`/api/materials/search?${params}`, {
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[search:client] Got ${(data.materials ?? []).length} results`);
        setResults(data.materials ?? []);
      } else {
        console.error(`[search:client] Error ${res.status}:`, data);
        setSearchError(data.details || data.error || `Search failed (${res.status})`);
      }
    } catch (err) {
      console.error("[search:client] Fetch error:", err);
      const msg = err instanceof Error ? err.message : "Network error";
      setSearchError(
        msg.includes("abort") || msg.includes("timeout")
          ? "Search timed out — try syncing the database first"
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [activeDataSource]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/data-sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: activeDataSource }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.details || data.error || "Sync failed");
        return;
      }
      // Re-search after sync
      if (query.trim()) {
        await handleSearch(query);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [activeDataSource, query, handleSearch]);

  // Auto-search when material is selected
  useEffect(() => {
    if (selectedMaterialName) {
      setQuery(selectedMaterialName);
      handleSearch(selectedMaterialName);
    }
  }, [selectedMaterialName, handleSearch]);

  function handleBack() {
    setBatchMatchMaterials([]);
    setSelectedMaterial(null);
  }

  async function handleSelectMatch(lcaMaterial: NormalizedMaterial) {
    if (!project) return;

    if (isBatchMode) {
      // Batch mode: apply to all selected materials
      await applyBatchMatch(lcaMaterial);
    } else {
      // Single mode: apply to one material
      await applySingleMatch(lcaMaterial);
    }
  }

  async function applySingleMatch(lcaMaterial: NormalizedMaterial) {
    if (!selectedMaterialName || !project) return;

    // Save previous state for rollback
    const previousMaterial = materials.find(
      (m) => m.name === selectedMaterialName
    );
    const previousMatch = previousMaterial?.match;
    const previousMatchedMaterial = previousMaterial?.matchedMaterial;

    // Update local state immediately (optimistic)
    const matchData = {
      lcaMaterialId: lcaMaterial.id,
      sourceId: lcaMaterial.sourceId,
      source: lcaMaterial.source,
      score: 1.0,
      method: "manual" as const,
      matchedAt: new Date(),
    };
    updateMaterialMatch(selectedMaterialName, matchData, lcaMaterial);

    try {
      // Persist to server
      const res = await fetch("/api/materials/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          materialName: selectedMaterialName,
          lcaMaterialId: lcaMaterial.id,
          source: lcaMaterial.source,
          sourceId: lcaMaterial.sourceId,
          method: "manual",
          score: 1.0,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      // Go back: element view if an element is selected, otherwise summary
      const state = useAppStore.getState();
      setContextPanelMode(state.selectedElementIds.size > 0 ? "element" : "summary");
    } catch (err) {
      console.error("Failed to persist material match:", err);
      if (previousMatch && previousMatchedMaterial) {
        updateMaterialMatch(
          selectedMaterialName,
          previousMatch,
          previousMatchedMaterial
        );
      } else {
        updateMaterialMatch(selectedMaterialName, null, null);
      }
    }
  }

  async function applyBatchMatch(lcaMaterial: NormalizedMaterial) {
    if (!project || batchNames.length === 0) return;
    setApplying(true);

    const matchData = {
      lcaMaterialId: lcaMaterial.id,
      sourceId: lcaMaterial.sourceId,
      source: lcaMaterial.source,
      score: 1.0,
      method: "manual" as const,
      matchedAt: new Date(),
    };

    // Optimistic: update all locally
    for (const name of batchNames) {
      updateMaterialMatch(name, matchData, lcaMaterial);
    }

    // Persist each to server (sequentially to avoid overwhelming)
    let failed = 0;
    for (const name of batchNames) {
      try {
        const res = await fetch("/api/materials/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            materialName: name,
            lcaMaterialId: lcaMaterial.id,
            source: lcaMaterial.source,
            sourceId: lcaMaterial.sourceId,
            method: "manual",
            score: 1.0,
          }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setApplying(false);

    if (failed > 0) {
      console.error(`[batch-match] ${failed}/${batchNames.length} failed to persist`);
    }

    // Go back to summary
    setBatchMatchMaterials([]);
    setContextPanelMode("summary");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {isBatchMode ? "Batch Match" : "Match Material"}
            </h3>
            {isBatchMode ? (
              <p className="text-sm font-medium">
                {batchNames.length} materials selected
              </p>
            ) : (
              <p className="text-sm font-medium">{selectedMaterialName}</p>
            )}
          </div>
        </div>

        {/* Batch mode: show selected material names */}
        {isBatchMode && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Applying match to:
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {batchNames.slice(0, 10).map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
              {batchNames.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{batchNames.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Current match (single mode only) */}
        {!isBatchMode && currentMaterial?.match && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  Currently matched
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950"
                title="Remove match"
                onClick={async () => {
                  if (!selectedMaterialName || !project) return;
                  updateMaterialMatch(selectedMaterialName, null, null);
                  try {
                    await fetch("/api/materials/unmatch", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        projectId: project.id,
                        materialName: selectedMaterialName,
                      }),
                    });
                  } catch (err) {
                    console.error("Failed to unmatch:", err);
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              {currentMaterial.matchedMaterial?.name}
            </p>
            <div className="mt-1 flex gap-2">
              <Badge variant="outline" className="text-xs">
                {currentMaterial.match.source}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {currentMaterial.match.method} ({(currentMaterial.match.score * 100).toFixed(0)}%)
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="border-b p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="Search LCA materials..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSearch(query)}
            disabled={loading || syncing || applying}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3 w-3" />
          Searching in: {activeDataSource.toUpperCase()}
        </div>
      </div>

      {/* Applying overlay */}
      {applying && (
        <div className="flex items-center gap-3 border-b bg-primary/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">
            Applying match to {batchNames.length} materials...
          </span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchError && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-destructive">{searchError}</p>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync {activeDataSource.toUpperCase()} data
            </Button>
          </div>
        )}

        {!searchError && results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Search className="mb-1 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {query ? "No results found" : "Search for LCA materials"}
            </p>
            {query && (
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync {activeDataSource.toUpperCase()} database
              </Button>
            )}
          </div>
        )}

        {results.map((mat) => (
          <button
            key={mat.id}
            className="w-full border-b p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => handleSelectMatch(mat)}
            disabled={applying}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium">{mat.name}</p>
                <p className="text-xs text-muted-foreground">
                  {mat.category}
                </p>
              </div>
              <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                {mat.source}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {mat.density != null && <span>Density: {mat.density} kg/m³</span>}
              {mat.indicators.gwpTotal != null && (
                <span>GWP: {mat.indicators.gwpTotal.toFixed(3)} kg CO₂-eq</span>
              )}
              {mat.indicators.ubp != null && (
                <span>UBP: {mat.indicators.ubp.toFixed(0)}</span>
              )}
              {mat.indicators.penreTotal != null && (
                <span>PENRE: {mat.indicators.penreTotal.toFixed(1)} MJ</span>
              )}
            </div>
            {isBatchMode && (
              <div className="mt-1 text-xs text-primary">
                Click to apply to {batchNames.length} materials
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
