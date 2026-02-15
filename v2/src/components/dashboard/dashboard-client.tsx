"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Plus, Building2, Clock, Leaf, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { projects } from "@/db/schema";

type Project = typeof projects.$inferSelect;

interface DashboardClientProps {
  projects: Project[];
}

export function DashboardClient({ projects: initialProjects }: DashboardClientProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic: track deleted project IDs to remove from list immediately
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const projects = initialProjects.filter((p) => !removedIds.has(p.id));

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        const { id } = await res.json();
        setName("");
        router.push(`/project/${id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to create project (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;

    // Optimistic: remove from list immediately
    setDeleting(projectId);
    setRemovedIds((prev) => new Set(prev).add(projectId));
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        // Revert optimistic removal
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to delete project (${res.status})`);
      } else {
        router.refresh();
      }
    } catch (err) {
      // Revert optimistic removal
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleting(null);
    }
  }

  // Dashboard summary stats
  const totalGwp = projects.reduce(
    (sum, p) => sum + (p.gwpTotal ?? 0),
    0
  );
  const projectsWithGwp = projects.filter(
    (p) => p.gwpTotal != null && p.gwpTotal > 0
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">IfcLCA</h1>
            <Badge variant="outline" className="text-xs">
              v2
            </Badge>
          </div>
          <UserButton />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Summary stats */}
        {projects.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">With LCA Results</p>
                <p className="text-2xl font-bold">{projectsWithGwp}</p>
              </CardContent>
            </Card>
            {totalGwp > 0 && (
              <Card className="sm:col-span-2">
                <CardContent className="flex items-center gap-3 p-4">
                  <Leaf className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total GWP (all projects)</p>
                    <p className="text-xl font-bold tabular-nums">
                      {totalGwp >= 1000
                        ? `${(totalGwp / 1000).toFixed(1)}t CO₂-eq`
                        : `${totalGwp.toFixed(0)} kg CO₂-eq`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Projects</h2>
            <p className="text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* New project input */}
        <Card className="mb-8">
          <CardContent className="flex items-center gap-4 p-4">
            <input
              type="text"
              placeholder="New project name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              disabled={creating}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || creating}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {creating ? "Creating..." : "Create"}
            </Button>
          </CardContent>
          {error && (
            <div className="border-t px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </Card>

        {/* Project grid */}
        {projects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No projects yet
            </p>
            <p className="text-sm text-muted-foreground/60">
              Create your first project to get started
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  deleting === project.id ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => router.push(`/project/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {project.gwpTotal != null && project.gwpTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <Leaf className="h-3.5 w-3.5 text-green-600" />
                        <span className="tabular-nums">
                          {project.gwpTotal >= 1000
                            ? `${(project.gwpTotal / 1000).toFixed(1)}t`
                            : `${project.gwpTotal.toFixed(0)} kg`}{" "}
                          CO₂-eq
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(project.updatedAt ?? project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {project.preferredDataSource ?? "kbob"}
                      </Badge>
                      {project.areaValue && project.areaValue > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {project.areaType ?? "Area"}: {project.areaValue.toLocaleString()} m²
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deleting === project.id}
                    >
                      {deleting === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
