"use client";

import * as React from "react";
import Link from "next/link";
import { defaultMetrics, iconMap } from "@/lib/data/metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Building,
  Box,
  Layers,
  Upload,
  PlusCircle,
  FileText,
  Users,
  BarChart,
} from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "@/components/activity-feed";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  description: string;
  elements: number;
  thumbnail: string;
  updatedAt: string;
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
}

interface Activity {
  id: string;
  type:
    | "project_created"
    | "file_uploaded"
    | "material_created"
    | "project_deleted"
    | "material_deleted"
    | "project_updated"
    | "new_user"
    | "project_member_added"
    | "project_member_removed";
  projectId: string;
  details: any;
  user: {
    name: string;
    avatar: string;
  };
  action: string;
  project: string;
  timestamp: string;
}

interface DashboardProps {
  initialRecentProjects?: Project[];
  statistics?: DashboardStatistics;
  initialActivities?: Activity[];
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
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (showProjectSelect) {
      fetchProjects();
    }
  }, [showProjectSelect]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    fetchActivities(1);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });
      const projects = await response.json();

      const recentProjects = projects.slice(0, 3);

      const totalElements = projects.reduce(
        (acc: number, project: any) => acc + (project._count?.elements || 0),
        0
      );

      const totalMaterials = projects.reduce(
        (acc: number, project: any) => acc + (project._count?.materials || 0),
        0
      );

      setStatistics((prev) => ({
        ...prev,
        totalProjects: projects.length,
        totalElements,
        totalMaterials,
      }));

      setRecentProjects(recentProjects);
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  const fetchActivities = async (page: number) => {
    try {
      setIsLoadingActivities(true);
      const response = await fetch(`/api/activities?page=${page}`);
      const data = await response.json();

      if (page === 1) {
        setActivities(data.activities);
      } else {
        setActivities((prev) => [...prev, ...data.activities]);
      }
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingActivities && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchActivities(nextPage);
    }
  };

  const handleUploadClick = async () => {
    try {
      const response = await fetch("/api/projects");
      const projects = await response.json();

      if (!projects?.length) {
        return;
      }
      setShowProjectSelect(true);
    } catch (error) {
      console.error("Failed to check projects:", error);
    }
  };

  const metrics: Metric[] = [
    {
      title: "Total Elements",
      value: statistics.totalElements,
      description: "Construction components",
      icon: "Box",
    },
    {
      title: "Total Projects",
      value: statistics.totalProjects,
      description: "Active projects",
      icon: "Building",
    },
    {
      title: "Total Materials",
      value: statistics.totalMaterials,
      description: "Unique materials",
      icon: "Layers",
    },
  ];

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
            <Button variant="outline" onClick={handleUploadClick}>
              <Upload className="mr-2 h-4 w-4" />
              Analyse IFC
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((item) => {
          const Icon = Icons[item.icon];
          return (
            <Card
              key={item.title}
              className="group transition-colors duration-200 hover:border-primary/50"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                  {item.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold group-hover:text-primary transition-colors">
                  {item.value.toLocaleString("de-CH", {
                    maximumFractionDigits: 0,
                    useGrouping: true,
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1 group-hover:text-primary/70 transition-colors">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
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
                    <Upload className="h-3 w-3" />
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
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="h-20 text-left justify-start">
            <FileText className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Recent Files</div>
              <div className="text-sm text-muted-foreground">
                Access your latest work
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <Users className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Team Projects</div>
              <div className="text-sm text-muted-foreground">
                Collaborate with your team
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <BarChart className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Analytics</div>
              <div className="text-sm text-muted-foreground">
                View project insights
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <Building className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Material Library</div>
              <div className="text-sm text-muted-foreground">
                Browse and manage materials
              </div>
            </div>
          </Button>
        </div>
      </section>

      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload the IFC file to
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
          onProgress={(progress: number) => {
            console.log("Upload progress:", progress);
          }}
        />
      )}
    </div>
  );
}
