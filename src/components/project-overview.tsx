"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  Plus,
  Upload,
  BarChart2,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type ImpactMetric = "GWP" | "PENR" | "UBP";

type Project = {
  id: string;
  name: string;
  description: string | null;
  phase: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    uploads: number;
    elements: number;
  };
};

export function ProjectOverview() {
  const [selectedMetric, setSelectedMetric] = useState<ImpactMetric>("GWP");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchProjects() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/projects");
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load projects";
        setError(message);
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const handleMetricChange = (value: ImpactMetric) => {
    setSelectedMetric(value);
    // Here you could fetch updated project data based on the selected metric
    // or filter/transform existing data
  };

  const indexOfLastProject = currentPage * pageSize;
  const indexOfFirstProject = indexOfLastProject - pageSize;
  const currentProjects = projects.slice(
    indexOfFirstProject,
    indexOfLastProject
  );

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete project");

      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });

      // Refresh the projects list
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      setProjects(updatedProjects);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteProjectId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Project Portfolio
        </h1>
        <div className="flex items-center gap-4">
          <Select value={selectedMetric} onValueChange={handleMetricChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GWP">Global Warming Potential</SelectItem>
              <SelectItem value="PENR">Primary Energy Non-Renewable</SelectItem>
              <SelectItem value="UBP">UBP (Umweltbelastungspunkte)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/projects/new" className="gap-2">
              <Plus className="h-5 w-5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <>
          <div aria-live="polite" className="sr-only">
            Loading projects...
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: pageSize }).map((_, index) => (
              <Card
                key={index}
                className="group relative transition-all hover:shadow-lg"
              >
                <CardContent className="p-6 pt-12">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-6" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="text-center py-12 bg-red-50 rounded-lg" role="alert">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="bg-white"
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Try Again
          </Button>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
          <h2 className="text-2xl font-semibold mb-2 text-primary">
            No Projects Yet
          </h2>
          <p className="text-muted-foreground mb-4">
            Create your first project to get started
          </p>
          <Button
            asChild
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/projects/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentProjects.map((project) => (
            <Card
              key={project.id}
              className="group relative transition-all hover:shadow-lg border-2 border-muted overflow-hidden cursor-pointer"
              tabIndex={0}
              role="article"
              aria-labelledby={`project-title-${project.id}`}
              onClick={() => router.push(`/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/projects/${project.id}`);
                }
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Badge
                variant="secondary"
                className="absolute left-4 top-4 h-8 px-2 rounded-full flex items-center justify-center text-sm font-medium bg-primary text-primary-foreground"
              >
                {project._count.uploads} uploads
              </Badge>
              <div className="absolute right-4 top-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteProjectId(project.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardContent className="p-6 pt-12">
                <h2
                  id={`project-title-${project.id}`}
                  className="text-xl font-semibold mb-2 text-primary"
                >
                  {project.name}
                </h2>
                <p className="text-muted-foreground mb-6 line-clamp-2">
                  {project.description || "No description provided"}
                </p>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Building Elements
                  </div>
                  <div className="font-mono text-lg text-primary">
                    {project._count.elements} elements
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <Button
                  asChild
                  variant="ghost"
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300"
                >
                  <Link href={`/projects/${project.id}`} className="gap-2">
                    View Details
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !error && projects.length > pageSize && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
          <div className="flex items-center gap-2">
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 12, 24].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Showing {indexOfFirstProject + 1}-
              {Math.min(indexOfLastProject, projects.length)} of{" "}
              {projects.length}
            </span>
          </div>
          <nav className="flex justify-center" aria-label="Pagination">
            <ul className="inline-flex gap-2">
              {Array.from({
                length: Math.ceil(projects.length / pageSize),
              }).map((_, index) => (
                <li key={index}>
                  <Button
                    variant={currentPage === index + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(index + 1)}
                    aria-current={
                      currentPage === index + 1 ? "page" : undefined
                    }
                    className={
                      currentPage === index + 1
                        ? "bg-primary text-primary-foreground"
                        : ""
                    }
                  >
                    {index + 1}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <AlertDialog
        open={deleteProjectId !== null}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteProjectId && handleDeleteProject(deleteProjectId)
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
