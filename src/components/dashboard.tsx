"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Building, Layers, PlusCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UploadModal } from "@/components/upload-modal";
import { DashboardEmissionsCard } from "@/components/dashboard-emissions-card";
import { ActivityFeedEnhanced } from "@/components/activity-feed-enhanced";
import { ProjectCardOptimized, ProjectCardSkeleton } from "@/components/project-card-optimized";
import { StatisticsCard, StatisticsCardSkeleton } from "@/components/statistics-card";
import { Activity as ActivityType } from "@/lib/types/activity";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description: string;
  elements: number;
  thumbnail: string;
  updatedAt: string;
  imageUrl?: string;
  _count: {
    elements: number;
    uploads: number;
    materials: number;
  };
}

interface DashboardStatistics {
  totalProjects: number;
  totalElements: number;
  totalMaterials: number;
  recentActivities: number;
  totalEmissions?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  trends?: {
    projects: { value: number; isPositive: boolean };
    elements: { value: number; isPositive: boolean };
    materials: { value: number; isPositive: boolean };
  };
}

interface DashboardProps {
  initialRecentProjects?: Project[];
  statistics?: DashboardStatistics;
  initialActivities?: ActivityType[];
}

export function Dashboard({
  initialRecentProjects = [],
  statistics: initialStatistics = {
    totalProjects: 0,
    totalElements: 0,
    totalMaterials: 0,
    recentActivities: 0,
  },
  initialActivities = [],
}: DashboardProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State management
  const [statistics, setStatistics] = useState<DashboardStatistics>(initialStatistics);
  const [recentProjects, setRecentProjects] = useState<Project[]>(initialRecentProjects);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Upload modal state
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);

  // Memoized statistics data
  const statisticsData = useMemo(
    () => [
      {
        title: "Total Projects",
        value: statistics.totalProjects,
        description: "Active projects in your workspace",
        icon: Building,
        trend: statistics.trends?.projects,
      },
      {
        title: "Total Elements",
        value: statistics.totalElements,
        description: "Building elements across all projects",
        icon: Box,
        trend: statistics.trends?.elements,
      },
      {
        title: "Total Materials",
        value: statistics.totalMaterials,
        description: "Unique materials in use",
        icon: Layers,
        trend: statistics.trends?.materials,
      },
    ],
    [statistics]
  );

  // Fetch functions
  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoadingStatistics(true);

      const [projectsRes, emissionsRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/emissions", { cache: "no-store" }),
      ]);

      if (!projectsRes.ok) throw new Error("Failed to fetch projects");

      const [projects, emissions] = await Promise.all([
        projectsRes.json(),
        emissionsRes.ok ? emissionsRes.json() : null,
      ]);

      // Calculate statistics
      const totalElements = projects.reduce(
        (acc: number, project: any) => acc + (project._count?.elements || 0),
        0
      );
      const totalMaterials = projects.reduce(
        (acc: number, project: any) => acc + (project._count?.materials || 0),
        0
      );

      // Get recent projects (first 3 for faster loading)
      const recent = projects
        .sort((a: any, b: any) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 3);

      setStatistics({
        totalProjects: projects.length,
        totalElements,
        totalMaterials,
        recentActivities: 0,
        totalEmissions: emissions,
      });

      setRecentProjects(recent);
      setIsLoadingProjects(false);
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStatistics(false);
    }
  }, [toast]);

  const handleUploadClick = async () => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const projects = await response.json();

      if (!projects?.length) {
        toast({
          title: "No projects",
          description: "Please create a project first",
          variant: "destructive",
        });
        return;
      }

      setAvailableProjects(projects);
      setShowProjectSelect(true);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    }
  };

  const handleProjectDelete = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project deleted successfully",
        });

        // Refresh data
        fetchStatistics();
      } else {
        throw new Error("Failed to delete project");
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  // Initial data fetch
  useEffect(() => {
    setIsLoadingProjects(true);
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <div className="min-h-screen bg-background">
      <div className="main-container space-y-8 py-8">
        {/* Header Section */}
        <section className="space-y-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Home</h1>
              <p className="text-muted-foreground">
                Overview of your projects and recent activity
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="default">
                <Link href="/projects/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Project
                </Link>
              </Button>
              <Button variant="outline" onClick={handleUploadClick}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Upload IFC
              </Button>
            </div>
          </div>
        </section>

        {/* Statistics Grid */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoadingStatistics ? (
            <>
              {[...Array(4)].map((_, i) => (
                <StatisticsCardSkeleton key={i} />
              ))}
            </>
          ) : (
            <>
              {statisticsData.map((stat) => (
                <StatisticsCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  description={stat.description}
                  icon={stat.icon}
                  trend={stat.trend}
                />
              ))}
              <DashboardEmissionsCard emissions={statistics.totalEmissions} />
            </>
          )}
        </section>

        {/* Recent Projects Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Recent Projects</h2>
              <p className="text-sm text-muted-foreground">
                Your most recently updated projects
              </p>
            </div>
            {statistics.totalProjects > 3 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">
                  View all projects
                  <TrendingUp className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingProjects ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <ProjectCardSkeleton key={i} />
                ))}
              </>
            ) : recentProjects.length === 0 ? (
              <div className="col-span-full">
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center">
                  <Building className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Get started by creating your first project
                  </p>
                  <Button asChild>
                    <Link href="/projects/new">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Project
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              recentProjects.map((project, index) => (
                <ProjectCardOptimized
                  key={project.id}
                  project={project}
                  onDelete={handleProjectDelete}
                  priority={index < 3}
                />
              ))
            )}
          </div>
        </section>

        {/* Activity Feed Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Activity Feed</h2>
            <p className="text-sm text-muted-foreground">
              Recent actions and updates across all projects
            </p>
          </div>
          <ActivityFeedEnhanced
            initialActivities={initialActivities}
            limit={5}
            compact={true}
          />
        </section>
      </div>

      {/* Project Selection Dialog */}
      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload your IFC file to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {availableProjects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectSelect(false);
                }}
              >
                <Building className="mr-2 h-4 w-4 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium">{project.name}</div>
                  {project.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {project.description}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      {selectedProjectId && (
        <UploadModal
          projectId={selectedProjectId}
          open={true}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setSelectedProjectId(null);
            }
          }}
          onSuccess={() => {
            setSelectedProjectId(null);
            router.push(`/projects/${selectedProjectId}`);

            // Refresh dashboard data
            fetchStatistics();
          }}
          onProgress={(progress: number) => {
            // Progress handling if needed
          }}
        />
      )}
    </div>
  );
}
