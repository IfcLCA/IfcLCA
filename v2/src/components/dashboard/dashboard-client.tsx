"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Plus, Building2, BarChart3, Clock } from "lucide-react";
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

export function DashboardClient({ projects }: DashboardClientProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        const { id } = await res.json();
        router.push(`/project/${id}`);
      }
    } finally {
      setCreating(false);
    }
  }

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
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || creating}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </CardContent>
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
                className="cursor-pointer transition-shadow hover:shadow-md"
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
                    {project.gwpTotal != null && (
                      <div className="flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span>
                          {project.gwpTotal.toFixed(0)} kg CO₂-eq
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {project.preferredDataSource ?? "kbob"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {project.classificationSystem ?? "eBKP-H"}
                    </Badge>
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
