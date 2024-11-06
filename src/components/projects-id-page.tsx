"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/upload-modal";
import { useParams } from "next/navigation";
import { Trash2, Upload, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
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
import { toast } from "@/hooks/use-toast";
import type {
  Project,
  Upload as PrismaUpload,
  Element,
  Material,
} from "@prisma/client";
import { columns } from "@/components/columns";
import { ReloadIcon } from "@radix-ui/react-icons";
import { materialsColumns } from "@/components/materials-columns";

type ElementWithMaterials = Element & {
  materials: Material[];
};

interface ExtendedProject extends Project {
  uploads: PrismaUpload[];
  elements: ElementWithMaterials[];
  materials: Material[];
  _count: {
    elements: number;
    uploads: number;
    materials: number;
  };
}

export function Page() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [project, setProject] = useState<ExtendedProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch project");
      }
      const data = await response.json();
      setProject(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const handleDeleteProject = async () => {
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
      router.push("/projects");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
          role="alert"
        >
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded"
          role="alert"
        >
          <p className="font-bold">Project not found</p>
          <p>The requested project could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex space-x-4">
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-primary text-primary-foreground"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload IFC
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle>Total Elements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{project._count.elements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{project._count.uploads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{project._count.materials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {new Date(project.updatedAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="uploads" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="elements">Elements</TabsTrigger>
          <TabsTrigger value="materials">
            Materials ({project?._count.materials || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads" className="space-y-4">
          {project.uploads.length === 0 ? (
            <div className="text-center p-8 bg-muted rounded-lg">
              <p className="text-muted-foreground">
                No uploads yet. Start by uploading an IFC file.
              </p>
            </div>
          ) : (
            project.uploads.map((upload) => (
              <Card key={upload.id}>
                <CardContent className="flex justify-between items-center p-4">
                  <div>
                    <p className="font-medium">{upload.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(upload.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {upload.elementCount} elements
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        upload.status === "Completed"
                          ? "text-green-600"
                          : upload.status === "Failed"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {upload.status}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="elements" className="space-y-4">
          <DataTable
            columns={columns}
            data={project.elements}
            onRowSelectionChange={(rows) => console.log("Selected:", rows)}
          />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          {project?.materials && project.materials.length > 0 ? (
            <DataTable
              columns={materialsColumns}
              data={project.materials}
              onRowSelectionChange={(rows) =>
                console.log("Selected materials:", rows)
              }
            />
          ) : (
            <div className="text-center p-8 bg-muted rounded-lg">
              <p className="text-muted-foreground">
                No materials found. Materials will be extracted from IFC files
                when uploaded.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UploadModal
        projectId={projectId}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onSuccess={async (upload) => {
          toast({
            title: "Upload Successful",
            description: "Your IFC file has been uploaded and processed.",
          });
          await fetchProject();
        }}
        onProgress={(progress) => {
          console.log("Upload progress:", progress);
        }}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
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
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
