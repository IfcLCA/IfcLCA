"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Database,
} from "lucide-react";
import type { NormalizedMaterial } from "@/types/lca";

/**
 * Material matching panel — search and assign LCA materials
 * to an IFC material name.
 */
export function MaterialMatch() {
  const {
    selectedMaterialName,
    materials,
    activeDataSource,
    project,
    setSelectedMaterial,
    setContextPanelMode,
    updateMaterialMatch,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  const currentMaterial = materials.find(
    (m) => m.name === selectedMaterialName
  );

  // Auto-search when material is selected
  useEffect(() => {
    if (selectedMaterialName) {
      setQuery(selectedMaterialName);
      handleSearch(selectedMaterialName);
    }
  }, [selectedMaterialName]);

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        source: activeDataSource,
      });
      const res = await fetch(`/api/materials/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.materials ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMatch(lcaMaterial: NormalizedMaterial) {
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

      // Go back to element view
      setContextPanelMode("element");
    } catch (err) {
      console.error("Failed to persist material match:", err);
      // Revert optimistic update — clear the match if this was a first-time
      // match (previousMatch undefined), or restore the previous match.
      if (previousMatch && previousMatchedMaterial) {
        updateMaterialMatch(
          selectedMaterialName,
          previousMatch,
          previousMatchedMaterial
        );
      } else {
        // First match attempt failed — clear the optimistic state
        updateMaterialMatch(selectedMaterialName, null, null);
      }
    }
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
            onClick={() => setSelectedMaterial(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Match Material
            </h3>
            <p className="text-sm font-medium">{selectedMaterialName}</p>
          </div>
        </div>

        {/* Current match */}
        {currentMaterial?.match && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                Currently matched
              </span>
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
            disabled={loading}
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {query ? "No results found" : "Search for LCA materials"}
            </p>
          </div>
        )}

        {results.map((mat) => (
          <button
            key={mat.id}
            className="w-full border-b p-4 text-left transition-colors hover:bg-accent"
            onClick={() => handleSelectMatch(mat)}
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
          </button>
        ))}
      </div>
    </div>
  );
}
