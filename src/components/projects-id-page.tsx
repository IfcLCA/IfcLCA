"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { ReloadIcon } from "@radix-ui/react-icons";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Trash2,
  Upload,
  FileText,
  Box,
  Layers,
  UploadCloud,
  Edit,
  ImageIcon,
  Activity,
} from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import { DataTable } from "@/components/data-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { columns } from "@/components/columns";
import { materialsColumns } from "@/components/materials-columns";
import { GraphPageComponent } from "@/components/graph-page";
import { DashboardCards } from "@/components/dashboard-cards";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { emissionsColumns } from "@/components/emissions-columns";

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
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
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

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      const transformed = transformProjectData(data);
      setProject(transformed);
    } catch (err) {
      console.error("Error fetching project:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const transformProjectData = (data: any): ExtendedProject => ({
    ...data,
    id: data.id || data._id,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    uploads: data.uploads.map((upload: any) => ({
      ...upload,
      _id: upload._id,
      filename: upload.filename,
      status: upload.status,
      elementCount: upload.elementCount,
      createdAt: new Date(upload.createdAt),
    })),
    elements: data.elements.map((element: any) => ({
      ...element,
      id: element.id || element._id,
      _id: element._id,
      materials: element.materials || [],
    })),
    materials:
      data.materials?.map((material: any) => ({
        id: material.id || material._id,
        name: material.name,
        category: material.category,
        volume: material.volume || 0,
        fraction: material.fraction || 0,
      })) || [],
    _count: {
      uploads: data.uploads?.length || 0,
      elements: data.elements?.length || 0,
      materials: data.materials?.length || 0,
    },
  });

  const handleDeleteProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete project");
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

  const handleEditProject = () => router.push(`/projects/${projectId}/edit`);

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

  const handleUploadComplete = async () => {
    try {
      await fetchProject();
    } catch (error) {
      console.error("Failed to refresh project data:", error);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!project) return <ProjectNotFound />;

  const breadcrumbItems = [
    { label: "Projects", href: "/projects" },
    { label: project.name || "Loading...", href: undefined },
  ];

  const materialsWithCount =
    project.materials?.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      volume: m.volume,
    })) || [];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Breadcrumbs items={breadcrumbItems} />
      <ProjectHeader
        project={project}
        onUpload={() => setIsUploadModalOpen(true)}
        onEdit={handleEditProject}
      />
      <ProjectOverview project={project} />
      <ProjectTabs
        project={project}
        onUpload={() => setIsUploadModalOpen(true)}
        materialsWithCount={materialsWithCount}
      />
      <UploadModal
        projectId={projectId}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDelete={handleDeleteProject}
      />
    </div>
  );
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="container mx-auto p-6">
    <div
      className="bg-destructive/15 border-l-4 border-destructive text-destructive p-4 rounded"
      role="alert"
    >
      <p className="font-bold">Error</p>
      <p>{message}</p>
    </div>
  </div>
);

const ProjectNotFound = () => (
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

const ProjectHeader = ({
  project,
  onUpload,
  onEdit,
}: {
  project: ExtendedProject;
  onUpload: () => void;
  onEdit: () => void;
}) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
      <h1 className="text-3xl font-bold text-primary">{project.name}</h1>
      {project.description && (
        <p className="text-muted-foreground mt-1">{project.description}</p>
      )}
    </div>
    <div className="flex flex-col sm:flex-row gap-4">
      <Button onClick={onUpload} className="bg-primary text-primary-foreground">
        <Upload className="mr-2 h-4 w-4" />
        Upload IFC
      </Button>
      <Button variant="outline" onClick={onEdit}>
        <Edit className="mr-2 h-4 w-4" />
        Edit Project
      </Button>
    </div>
  </div>
);

const ProjectOverview = ({ project }: { project: ExtendedProject }) => (
  <div className="space-y-4">
    <DashboardCards
      elements={project._count.elements}
      uploads={project._count.uploads}
      materials={project._count.materials}
      project={project}
    />
  </div>
);

const ProjectTabs = ({
  project,
  onUpload,
  materialsWithCount,
}: {
  project: ExtendedProject;
  onUpload: () => void;
  materialsWithCount: any[];
}) => (
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
      <TabsTrigger
        value="emissions"
        className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
      >
        Emissions
      </TabsTrigger>
      <TabsTrigger
        value="graph"
        className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
      >
        Graph
      </TabsTrigger>
    </TabsList>

    <TabsContent value="uploads" className="space-y-4">
      <UploadsTab project={project} onUpload={onUpload} />
    </TabsContent>

    <TabsContent value="elements" className="space-y-4">
      <ElementsTab project={project} />
    </TabsContent>

    <TabsContent value="materials" className="space-y-4">
      <MaterialsTab
        project={project}
        materialsWithCount={materialsWithCount}
        onUpload={onUpload}
      />
    </TabsContent>

    <TabsContent value="emissions" className="space-y-4">
      <EmissionsTab project={project} />
    </TabsContent>

    <TabsContent value="graph" className="space-y-4">
      <GraphTab />
    </TabsContent>
  </Tabs>
);

const UploadsTab = ({
  project,
  onUpload,
}: {
  project: ExtendedProject;
  onUpload: () => void;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sort uploads by createdAt in descending order (newest first)
  const sortedUploads = [...(project?.uploads || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Calculate pagination
  const totalPages = Math.ceil((sortedUploads?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUploads = sortedUploads.slice(startIndex, endIndex);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          Uploads{" "}
          <Badge variant="secondary" className="ml-2">
            {project?.uploads?.length || 0}
          </Badge>
        </h2>
        <Button onClick={onUpload} variant="outline">
          <UploadCloud className="h-4 w-4 mr-2" />
          Upload IFC
        </Button>
      </div>
      {!project?.uploads || project.uploads.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title="No uploads yet"
          description="Start by uploading an IFC file."
          action={<Button onClick={onUpload}>Upload IFC</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {currentUploads.map((upload) => (
              <UploadCard key={upload._id} upload={upload} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      currentPage > 1 && setCurrentPage((prev) => prev - 1)
                    }
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      currentPage < totalPages &&
                      setCurrentPage((prev) => prev + 1)
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </>
  );
};

const UploadCard = ({ upload }: { upload: ExtendedProject["uploads"][0] }) => (
  <Card>
    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-3">
      <div className="space-y-1">
        <p className="font-medium text-base">{upload.filename}</p>
        <p className="text-sm text-muted-foreground">
          Uploaded on {new Date(upload.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Elements:</span>
          <Badge variant="secondary">{upload.elementCount}</Badge>
        </div>
        <Badge variant={upload.status === "Completed" ? "success" : "warning"}>
          {upload.status}
        </Badge>
      </div>
    </CardContent>
  </Card>
);

const ElementsTab = ({ project }: { project: ExtendedProject }) => (
  <>
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
          onRowSelectionChange={() => {}}
        />
      </CardContent>
    </Card>
  </>
);

const MaterialsTab = ({
  project,
  materialsWithCount,
  onUpload,
}: {
  project: ExtendedProject;
  materialsWithCount: any[];
  onUpload: () => void;
}) => (
  <>
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
            onRowSelectionChange={() => {}}
          />
        </CardContent>
      </Card>
    ) : (
      <EmptyState
        icon={Layers}
        title="No materials found"
        description="Materials will be extracted from IFC files when uploaded."
        action={<Button onClick={onUpload}>Upload IFC</Button>}
      />
    )}
  </>
);

const EmissionsTab = ({ project }: { project: ExtendedProject }) => {
  const data = project.elements.flatMap((element) =>
    element.materials.map((materialEntry) => ({
      name: element.name || "Unknown",
      volume: materialEntry.volume || 0,
      indicators: materialEntry.indicators || {
        gwp: 0,
        ubp: 0,
        penre: 0,
      },
    }))
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          Emissions{" "}
          <Badge variant="secondary" className="ml-2">
            LCA
          </Badge>
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={emissionsColumns}
            data={data}
            onRowSelectionChange={() => {}}
          />
        </CardContent>
      </Card>
    </>
  );
};

const GraphTab = () => (
  <>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-semibold">
        Graph Analysis{" "}
        <Badge variant="secondary" className="ml-2">
          Beta
        </Badge>
      </h2>
    </div>
    <GraphPageComponent />
  </>
);

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action: React.ReactNode;
}) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center h-32">
      <Icon className="h-12 w-12 text-muted-foreground mb-2" />
      <p className="text-muted-foreground text-center">{title}</p>
      <p className="text-sm text-muted-foreground text-center mt-1">
        {description}
      </p>
      <div className="mt-2">{action}</div>
    </CardContent>
  </Card>
);

const DeleteProjectDialog = ({
  isOpen,
  onClose,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete the project
          and all associated data.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onDelete}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete Project
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
