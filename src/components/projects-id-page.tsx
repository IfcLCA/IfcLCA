"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/upload-modal";
import {
  Trash2,
  Upload,
  AlertTriangle,
  FileText,
  Box,
  Layers,
  UploadCloud,
  Edit,
  ImageIcon,
} from "lucide-react";
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
import { columns } from "@/components/columns";
import { ReloadIcon } from "@radix-ui/react-icons";
import { materialsColumns } from "@/components/materials-columns";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Image from "next/image";
import { Input } from "@/components/ui/input";

type ElementWithMaterials = {
  id: string;
  _id: string;
  guid: string;
  name: string;
  type?: string;
  volume?: number;
  buildingStorey?: string;
  materials: {
    id: string;
    name: string;
    category?: string;
    volume?: number;
  }[];
};

interface ExtendedProject {
  id: string;
  name: string;
  description?: string;
  phase?: string;
  createdAt: Date;
  updatedAt: Date;
  uploads: {
    _id: string;
    filename: string;
    status: string;
    elementCount: number;
    createdAt: Date;
  }[];
  elements: ElementWithMaterials[];
  materials: {
    id: string;
    name: string;
    category?: string;
    volume?: number;
    fraction: number;
  }[];
  _count: {
    elements: number;
    uploads: number;
    materials: number;
  };
  imageUrl?: string;
}

export default function ProjectDetailsPage() {
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

      const transformedData = {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        uploads: data.uploads.map((upload: any) => {
          const uploadElementCount =
            data.elements?.filter(
              (element: any) => element.uploadId === upload._id
            ).length || 0;

          return {
            ...upload,
            _id: upload._id,
            createdAt: new Date(upload.createdAt),
            elementCount: uploadElementCount,
            status: uploadElementCount > 0 ? "Completed" : "Processing",
          };
        }),
      };

      setProject(transformedData);
    } catch (err) {
      console.error("Error fetching project:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
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

  const handleRowSelectionChange = (rows: Record<string, boolean>) => {
    console.log("Selected:", rows);
  };

  const materialsWithCount =
    project?.materials?.map((m) => ({
      id: m.id,
      name: m.name,
      count: project.elements.filter((element) =>
        element.materials.some((material) => material.name === m.name)
      ).length,
    })) || [];

  const handleEditProject = () => {
    router.push(`/projects/${projectId}/edit`);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setProject((prevProject) =>
          prevProject ? { ...prevProject, imageUrl } : null
        );
      };
      reader.readAsDataURL(file);
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
          className="bg-destructive/15 border-l-4 border-destructive text-destructive p-4 rounded"
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
          className="bg-warning/15 border-l-4 border-warning text-warning-foreground p-4 rounded"
          role="alert"
        >
          <p className="font-bold">Project not found</p>
          <p>The requested project could not be found.</p>
        </div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Projects", href: "/projects" },
    { label: project?.name || "Loading...", href: undefined },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-primary text-primary-foreground"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload IFC
          </Button>
          <Button variant="outline" onClick={handleEditProject}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="col-span-1 sm:col-span-2 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Image</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {project.imageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  src={project.imageUrl}
                  alt={project.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-video w-full border-2 border-dashed rounded-lg p-4">
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  No project image uploaded
                </p>
                <label htmlFor="image-upload" className="cursor-pointer mt-2">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Elements
            </CardTitle>
            <Box className="h-4 w-4 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project._count.elements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploads</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project._count.uploads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project._count.materials}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(project.updatedAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="uploads" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger
            value="uploads"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            Uploads
          </TabsTrigger>
          <TabsTrigger
            value="elements"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            Elements
          </TabsTrigger>
          <TabsTrigger
            value="materials"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            Materials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              Uploads{" "}
              <Badge variant="secondary" className="ml-2">
                {project?.uploads?.length || 0}
              </Badge>
            </h2>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              variant="outline"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload IFC
            </Button>
          </div>

          {!project?.uploads || project.uploads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <UploadCloud className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No uploads yet. Start by uploading an IFC file.
                </p>
                <Button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4"
                >
                  Upload IFC
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {project.uploads.map((upload) => (
                <Card key={upload._id}>
                  <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-4">
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{upload.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded on{" "}
                        {new Date(upload.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Elements:</span>
                        <Badge variant="secondary">{upload.elementCount}</Badge>
                      </div>
                      <Badge
                        variant={
                          upload.elementCount > 0 ? "success" : "warning"
                        }
                      >
                        {upload.elementCount > 0 ? "Completed" : "Processing"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="elements" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              Elements{" "}
              <Badge variant="secondary" className="ml-2">
                {project?._count.elements || 0}
              </Badge>
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={project.elements}
                onRowSelectionChange={handleRowSelectionChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              Materials{" "}
              <Badge variant="secondary" className="ml-2">
                {project?._count.materials || 0}
              </Badge>
            </h2>
          </div>
          {project?.materials && project.materials.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <DataTable
                  columns={materialsColumns}
                  data={materialsWithCount}
                  onRowSelectionChange={(rows) =>
                    console.log("Selected materials:", rows)
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Layers className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No materials found. Materials will be extracted from IFC files
                  when uploaded.
                </p>
                <Button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4"
                >
                  Upload IFC
                </Button>
              </CardContent>
            </Card>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
