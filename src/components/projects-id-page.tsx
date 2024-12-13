"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { DashboardCards } from "@/components/dashboard-cards";
import { DataTable } from "@/components/data-table";
import { elementsColumns } from "@/components/elements-columns";
import { emissionsColumns } from "@/components/emissions-columns";
import { GraphPageComponent } from "@/components/graph-page";
import { materialsColumns } from "@/components/materials-columns";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadModal } from "@/components/upload-modal";
import { toast } from "@/hooks/use-toast";
import { ReloadIcon } from "@radix-ui/react-icons";
import cn from "classnames";
import { Edit, Layers, UploadCloud } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useProjectEmissions } from "@/hooks/use-project-emissions";

interface KBOBMaterial {
  _id: string;
  Name: string;
  Category?: string;
  GWP: number;
  UBP: number;
  PENRE: number;
}

interface Material {
  _id: string;
  name: string;
  category?: string;
  kbobMatchId?: KBOBMaterial;
}

interface MaterialEntry {
  name: string;
  volume: number;
  density: number;
  mass: number;
  thickness?: number;
  material?: {
    name: string;
    kbobMatchId?: {
      Name: string;
      GWP?: number;
      UBP?: number;
      PENRE?: number;
    };
  };
  indicators?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
}

interface ElementWithMaterials {
  _id: string;
  guid: string;
  name: string;
  type: string;
  object_type: string;
  volume: number;
  buildingStorey?: string;
  loadBearing?: boolean;
  isExternal?: boolean;
  materials: MaterialEntry[];
}

interface Upload {
  _id: string;
  filename: string;
  status: string;
  elementCount: number;
  createdAt: string | Date;
}

interface Project {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  uploads: Upload[];
  elements: any[];
  materials: {
    id: string;
    name: string;
    category?: string;
    volume?: number;
    fraction?: number;
    gwp?: number;
    ubp?: number;
    penre?: number;
  }[];
  _count: {
    uploads: number;
    elements: number;
    materials: number;
  };
}

interface ExtendedProject extends Project {
  elements: ElementWithMaterials[];
}

type IndicatorType = "gwp" | "ubp" | "penre";

const formatNumber = (value: number, decimalPlaces: number = 2) => {
  return (
    value?.toLocaleString("de-CH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }) ?? "N/A"
  );
};

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
      console.debug("🔄 Fetching project data...");

      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      console.debug("📥 Raw project data:", {
        id: data._id,
        name: data.name,
        uploadsCount: data.uploads?.length,
        uploads: data.uploads,
        elementCount: data.elements?.length,
      });

      const transformed = transformProjectData(data);

      console.debug("✨ Transformed project data:", {
        id: transformed.id,
        name: transformed.name,
        uploadsCount: transformed.uploads?.length,
        uploads: transformed.uploads,
        elementCount: transformed.elements?.length,
      });

      setProject(transformed);
    } catch (err) {
      console.error("❌ Error fetching project:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const transformProjectData = (data: any): ExtendedProject => {
    // Get unique materials from elements
    const uniqueMaterials = new Set(
      data.elements
        ?.flatMap((element: any) =>
          element.materials?.map((mat: any) => mat.material?._id)
        )
        .filter(Boolean) || []
    );

    return {
      ...data,
      id: data.id || data._id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      imageUrl: data.imageUrl,
      uploads: Array.isArray(data.uploads)
        ? data.uploads.map((upload: any) => ({
            _id: upload._id || upload.id,
            filename: upload.filename || "Unnamed file",
            status: upload.status || "unknown",
            elementCount: upload.elementCount || 0,
            createdAt: new Date(upload.createdAt),
          }))
        : [],
      elements: (data.elements || []).map((element: any) => ({
        ...element,
        id: element.id || element._id,
        _id: element._id,
        materials: element.materials || [],
      })),
      materials: (data.materials || []).map((material: any) => ({
        id: material.id || material._id,
        name: material.name,
        category: material.category,
        volume: material.volume || 0,
        fraction: material.fraction || 0,
        gwp: material.gwp || 0,
        ubp: material.ubp || 0,
        penre: material.penre || 0,
      })),
      _count: {
        uploads: data.uploads?.length || 0,
        elements: data.elements?.length || 0,
        materials: uniqueMaterials.size || 0,
      },
    };
  };

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
        onSuccess={handleUploadComplete}
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
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-primary">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>
    </div>
    <div className="flex flex-col sm:flex-row gap-4">
      <Button onClick={onUpload} className="bg-primary text-primary-foreground">
        <UploadCloud className="mr-2 h-4 w-4" />
        Add New Ifc
      </Button>
      <Button variant="outline" onClick={onEdit}>
        <Edit className="mr-2 h-4 w-4" />
        Edit Project
      </Button>
    </div>
  </div>
);

const ProjectOverview = ({ project }: { project: ExtendedProject }) => (
  <section className="space-y-4">
    <DashboardCards
      elements={project._count.elements}
      uploads={project._count.uploads}
      materials={project._count.materials}
      project={project}
    />
  </section>
);

const ProjectTabs = ({
  project,
  onUpload,
}: {
  project: Project;
  onUpload: () => void;
}) => (
  <Tabs defaultValue="uploads" className="w-full">
    <TabsList className="grid w-full grid-cols-4">
      <TabsTrigger value="uploads">Uploads</TabsTrigger>
      <TabsTrigger value="elements">Elements</TabsTrigger>
      <TabsTrigger value="materials">Materials</TabsTrigger>
      <TabsTrigger value="graph">Charts</TabsTrigger>
    </TabsList>

    <TabsContent value="uploads" className="space-y-4">
      <UploadsTab project={project} onUpload={onUpload} />
    </TabsContent>

    <TabsContent value="elements" className="space-y-4">
      <ElementsTab project={project} />
    </TabsContent>

    <TabsContent value="materials" className="space-y-4">
      <MaterialsTab project={project} />
    </TabsContent>

    <TabsContent value="graph" className="space-y-4">
      <GraphTab project={project} />
    </TabsContent>
  </Tabs>
);

const UploadsTab = ({
  project,
  onUpload,
}: {
  project: Project;
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
          Add New Ifc
        </Button>
      </div>
      {!project?.uploads || project.uploads.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title="No uploads yet"
          description="Get elements and materials from an Ifc file."
          action={
            <Button onClick={onUpload}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Add New Ifc
            </Button>
          }
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

const UploadCard = ({ upload }: { upload: Upload }) => (
  <Card>
    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-3">
      <div className="space-y-1">
        <p className="font-medium text-base">{upload.filename}</p>
        <p className="text-sm text-muted-foreground">
          Uploaded on {new Date(upload.createdAt).toLocaleString()}
        </p>
        {upload.elementCount > 0 && (
          <p className="text-sm text-muted-foreground">
            Elements: {upload.elementCount}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Badge
          variant={
            upload.status?.toLowerCase() === "completed" ? "success" : "warning"
          }
          className={cn(
            "transition-colors",
            upload.status?.toLowerCase() === "completed"
              ? "bg-green-100 text-green-800 hover:bg-green-200"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          )}
        >
          {upload.status}
        </Badge>
      </div>
    </CardContent>
  </Card>
);

const ElementsTab = ({ project }: { project: Project }) => {
  const data = useMemo(() => {
    return project.elements.map((element) => ({
      ...element,
      id: element._id,
    }));
  }, [project]);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          Elements{" "}
          <Badge variant="secondary" className="ml-2">
            {data.length}
          </Badge>
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable columns={elementsColumns} data={data} />
        </CardContent>
      </Card>
    </>
  );
};

const MaterialsTab = ({ project }: { project: Project }) => {
  const data = useMemo(() => {
    // Group materials by name and sum volumes
    const materialGroups = project.elements.reduce((acc, element) => {
      element.materials.forEach((mat) => {
        const key = mat.material._id;
        if (!acc[key]) {
          acc[key] = {
            _id: mat.material._id,
            material: mat.material,
            volume: 0,
            emissions: {
              gwp: 0,
              ubp: 0,
              penre: 0,
            },
          };
        }
        acc[key].volume += mat.volume;
        acc[key].emissions.gwp +=
          mat.volume *
          (mat.material.density || 0) *
          (mat.material.kbobMatch?.GWP || 0);
        acc[key].emissions.ubp +=
          mat.volume *
          (mat.material.density || 0) *
          (mat.material.kbobMatch?.UBP || 0);
        acc[key].emissions.penre +=
          mat.volume *
          (mat.material.density || 0) *
          (mat.material.kbobMatch?.PENRE || 0);
      });
      return acc;
    }, {} as Record<string, Material>);

    return Object.values(materialGroups);
  }, [project]);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          Materials{" "}
          <Badge variant="secondary" className="ml-2">
            {data.length}
          </Badge>
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable columns={materialsColumns} data={data} />
        </CardContent>
      </Card>
    </>
  );
};

const GraphTab = ({ project }: { project: Project }) => {
  const materialsData = project.elements.flatMap((element) =>
    // Create one entry per element-material combination
    element.materials.map((material) => ({
      name: element.name, // Element name from elements table
      elementName: element.name, // Explicit element name for grouping
      ifcMaterial: material.material?.name || "Unknown",
      kbobMaterial: material.material?.kbobMatch?.Name,
      category: element.type, // IFC entity type
      volume: material.volume, // Use individual material volume
      indicators: {
        gwp:
          material.volume *
          (material.material?.density || 0) *
          (material.material?.kbobMatch?.GWP || 0),
        ubp:
          material.volume *
          (material.material?.density || 0) *
          (material.material?.kbobMatch?.UBP || 0),
        penre:
          material.volume *
          (material.material?.density || 0) *
          (material.material?.kbobMatch?.PENRE || 0),
      },
    }))
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-6">
            <GraphPageComponent materialsData={materialsData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

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
        <AlertDialogTitle>
          Are you really sure you don't need it anymore?
        </AlertDialogTitle>
        <AlertDialogDescription className="space-y-2">
          <p>
            We can get it back but it involves us digging into our database,
            which we would rather avoid. So better be sure you don't need it
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
          onClick={onDelete}
        >
          Delete Project
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
