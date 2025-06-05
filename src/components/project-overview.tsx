"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  Plus,
  Upload,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2,
  Box,
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
import Image from "next/image";

type Project = {
  id: string;
  name: string;
  description: string | null;
  phase: string | null;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    uploads: number;
    elements: number;
    materials: number;
  };
  elements?: any[];
};

interface ProjectOverviewProps {}

export function ProjectOverview() {
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
        const response = await fetch("/api/projects?include=elements");
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();

        const transformedProjects = data.map((project: any) => {
          return {
            ...project,
            id: project.id || project._id,
            imageUrl: project.imageUrl,
            elements: project.elements || [],
            _count: {
              elements: project._count?.elements || 0,
              uploads: project._count?.uploads || 0,
              materials: project._count?.materials || 0,
            },
          };
        });

        setProjects(transformedProjects);
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

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

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
    <div>
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
        <div className="col-span-full text-center py-12 bg-muted rounded-lg">
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentProjects.map((project) => {
              return (
                <Card
                  key={project.id}
                  className="group relative transition-all hover:shadow-lg border-2 border-muted overflow-hidden"
                >
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-background/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${project.id}/edit`);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteProjectId(project.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div
                    className="aspect-video relative bg-muted cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    {project.imageUrl ? (
                      <>
                        <Image
                          src={project.imageUrl}
                          alt={project.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          priority={false}
                        />
                      </>
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
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {projects.length >= 3 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                ⚡️ You&apos;ve reached the project limit during our BETA phase. More
                projects coming soon! 🚀
              </p>
            </div>
          )}
        </>
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
            <AlertDialogTitle>
              Are you really sure you don&apos;t need it anymore?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                We can get it back but it involves us digging into our database,
                which we would rather avoid. So better be sure you don&apos;t need it
                anymore...
              </p>
              <p>
                This action cannot be undone. This will permanently delete the
                project and all associated data.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteProjectId && handleDeleteProject(deleteProjectId)
              }
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
