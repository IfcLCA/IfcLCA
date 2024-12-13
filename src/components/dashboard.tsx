"use client";

import { ActivityFeed } from "@/components/activity-feed";
import { EmissionsSummaryCard } from "@/components/emissions-summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadIfcButton } from "@/components/upload-ifc-button";
import { UploadModal } from "@/components/upload-modal";
import { Activity as ActivityType } from "@/lib/types/activity";
import { Box, Building, Layers, PlusCircle, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardEmissionsCard } from "@/components/dashboard-emissions-card";

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
}

interface DashboardProps {
  initialRecentProjects?: Project[];
  statistics?: DashboardStatistics;
  initialActivities?: ActivityType[];
}

// Define the icon components explicitly
const Icons = {
  Building: Building,
  Box: Box,
  Layers: Layers,
} as const;

// Type for the metrics
interface Metric {
  title: string;
  value: number;
  description: string;
  icon: keyof typeof Icons;
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
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const router = useRouter();
  const [statistics, setStatistics] = useState<DashboardStatistics>({
    totalProjects: 0,
    totalElements: 0,
    totalMaterials: 0,
    recentActivities: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>(
    initialRecentProjects
  );
  const [maxElements, setMaxElements] = useState(0);
  const [activities, setActivities] = useState(initialActivities);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const ITEMS_PER_PAGE = 5;

  const abortControllerRef = useRef<AbortController>();
  const lastFetchRef = useRef<number>(0);

  const CACHE_TIMEOUT = 5 * 60 * 1000;

  const metrics = useMemo(
    () => [
      {
        title: "Total Projects",
        value: statistics.totalProjects,
        description: "Active projects in your workspace",
        icon: "Building" as const,
      },
      {
        title: "Total Elements",
        value: statistics.totalElements,
        description: "Building elements across all projects",
        icon: "Box" as const,
      },
      {
        title: "Total Materials",
        value: statistics.totalMaterials,
        description: "Unique materials in use",
        icon: "Layers" as const,
      },
    ],
    [
      statistics.totalProjects,
      statistics.totalElements,
      statistics.totalMaterials,
    ]
  );

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }, []);

  const fetchStatistics = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < CACHE_TIMEOUT) {
        return; // Use cached data
      }

      try {
        setIsLoadingStatistics(true);

        // Cancel previous request if it exists
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const [projectsRes, emissionsRes] = await Promise.all([
          fetch("/api/projects", {
            signal: abortControllerRef.current.signal,
            cache: "no-store",
          }),
          fetch("/api/emissions", {
            signal: abortControllerRef.current.signal,
            cache: "no-store",
          }),
        ]);

        if (!projectsRes.ok || !emissionsRes.ok) {
          console.error("API Response not OK:", {
            projects: projectsRes.status,
            emissions: emissionsRes.status,
          });
          throw new Error("Failed to fetch data");
        }

        const [projects, emissions] = await Promise.all([
          projectsRes.json(),
          emissionsRes.json(),
        ]);

        const recentProjects = projects.slice(0, 3);
        const totalElements = projects.reduce(
          (acc: number, project: any) => acc + (project._count?.elements || 0),
          0
        );
        const totalMaterials = projects.reduce(
          (acc: number, project: any) => acc + (project._count?.materials || 0),
          0
        );

        const newStatistics = {
          ...statistics,
          totalProjects: projects.length,
          totalElements,
          totalMaterials,
          totalEmissions: emissions,
        };

        setStatistics(newStatistics);
        setRecentProjects(recentProjects);
        lastFetchRef.current = now;
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Failed to fetch statistics:", error);
        }
      } finally {
        setIsLoadingStatistics(false);
      }
    },
    [statistics]
  );

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoadingActivities(true);
      const response = await fetch("/api/activities?limit=6", {
        cache: "no-store",
      });
      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const prefetchNextPage = useCallback(() => {
    if (hasMore && !isLoadingActivities) {
      const nextPage = page + 1;
      const prefetchController = new AbortController();

      fetch(`/api/activities?page=${nextPage}`, {
        signal: prefetchController.signal,
        cache: "no-store",
      }).catch(() => {});
    }
  }, [hasMore, isLoadingActivities, page]);

  useEffect(() => {
    if (showProjectSelect) {
      fetchProjects();
    }
  }, [showProjectSelect, fetchProjects]);

  useEffect(() => {
    fetchStatistics();
    const intervalId = setInterval(() => {
      fetchStatistics(true);
    }, CACHE_TIMEOUT);

    return () => {
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStatistics]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1000
      ) {
        prefetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prefetchNextPage]);

  const handleLoadMore = () => {
    if (!isLoadingActivities && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchActivities();
    }
  };

  const handleUploadClick = async () => {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });
      const projects = await response.json();

      if (!projects?.length) {
        return;
      }
      setShowProjectSelect(true);
    } catch (error) {
      console.error("Failed to check projects:", error);
    }
  };

  return (
    <div className="main-container space-y-8">
      <section>
        <div className="page-header">
          <div>
            <h1 className="page-title">Home</h1>
            <p className="page-description">
              Overview of your projects and recent activity
            </p>
          </div>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/projects/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Project
              </Link>
            </Button>
            <UploadIfcButton variant="outline" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = Icons[metric.icon];
          return (
            <Card
              key={metric.title}
              className="group transition-all hover:bg-muted/5"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold group-hover:text-primary transition-colors">
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
        <DashboardEmissionsCard emissions={statistics.totalEmissions} />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Projects</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentProjects.map((project) => (
            <Card
              key={project.id}
              className="group relative transition-all hover:shadow-lg border-2 border-muted overflow-hidden cursor-pointer"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="aspect-video relative bg-muted">
                {project.imageUrl ? (
                  <Image
                    src={project.imageUrl}
                    alt={project.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Box className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <CardContent className="space-y-2 p-4">
                <h3 className="text-lg font-semibold leading-none tracking-tight">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Box className="h-3 w-3" />
                    {project._count.elements} elements
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <UploadCloud className="h-3 w-3" />
                    {project._count.uploads} uploads
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last update:{" "}
                  {new Date(project.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Activity Feed</h2>
        </div>
        <ActivityFeed
          activities={activities}
          isLoading={isLoadingActivities}
          hasMore={false}
          onLoadMore={handleLoadMore}
        />
      </section>

      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload the Ifc file to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectSelect(false);
                }}
              >
                {project.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedProjectId && (
        <UploadModal
          projectId={selectedProjectId}
          open={true}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setSelectedProjectId(null);
            }
          }}
          onSuccess={(upload: { id: string }) => {
            setSelectedProjectId(null);
            router.push(`/projects/${selectedProjectId}`);
          }}
          onProgress={(progress: number) => {}}
        />
      )}
    </div>
  );
}
