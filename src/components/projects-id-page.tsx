"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { DashboardCards } from "@/components/dashboard-cards";
import { DataTable } from "@/components/data-table";
import { elementsColumns } from "@/components/elements-columns";
import { ExportIfcModal } from "@/components/export-ifc-modal";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadModal } from "@/components/upload-modal";
import { toast } from "@/hooks/use-toast";
import { ReloadIcon } from "@radix-ui/react-icons";
import cn from "classnames";
import { Download, Edit, UploadCloud, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";
import type { ElementLcaResultsMap } from "@/lib/services/ifc-export-service";

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
  volume: number;
  fraction: number;
  thickness?: number;
  // Populated material data from API (replaces the original ObjectId)
  material?: {
    _id: string;
    name: string;
    density?: number;
    kbobMatchId?: string;
    kbobMatch?: {
      _id: string;
      Name: string;
      KBOB_ID: number;
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
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };
  classificationSystem?: string;
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
  usePagination?: boolean;
  elementCount?: number;
}

export interface ExtendedProject extends Project {
  elements: ElementWithMaterials[];
}

type IndicatorType = "gwp" | "ubp" | "penre";

type KBOBIndicatorValues = {
  GWP?: number;
  UBP?: number;
  PENRE?: number;
};

type ElementMaterialForExport = {
  volume?: number;
  fraction?: number;
  thickness?: number;
  indicators?: { gwp?: number; ubp?: number; penre?: number };
  material?: {
    _id?: string;
    name?: string;
    density?: number;
    kbobMatchId?: string;
    kbobMatch?: {
      _id: string;
      Name: string;
      KBOB_ID: number;
      GWP?: number;
      UBP?: number;
      PENRE?: number;
    };
  };
};

const parseMaybeNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toFiniteNumber = (value: unknown): number => parseMaybeNumber(value) ?? 0;

const resolveIndicator = (value: unknown, fallback: number): number => {
  const parsed = parseMaybeNumber(value);
  return parsed ?? fallback;
};

const formatNumber = (value: number, decimalPlaces: number = 2) => {
  return (
    value?.toLocaleString("de-CH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }) ?? "N/A"
  );
};

interface MaterialWithVolume {
  material: {
    _id: string;
    name: string;
    density?: number;
    kbobMatch?: {
      Name?: string;
      GWP?: number;
      UBP?: number;
      PENRE?: number;
    };
  };
  volume: number;
}

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [uploadToDelete, setUploadToDelete] = useState<string | null>(null);
  const [isDeleteUploadDialogOpen, setIsDeleteUploadDialogOpen] = useState(false);
  const [uploadDeleteImpact, setUploadDeleteImpact] = useState<any>(null);
  const [project, setProject] = useState<ExtendedProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingExportData, setIsLoadingExportData] = useState(false);
  const [fullElementsData, setFullElementsData] = useState<any>(null);

  const transformProjectData = useCallback((data: any): ExtendedProject => {
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
        density: material.density,
        volume: material.volume || 0,
        fraction: material.fraction || 0,
        gwp: material.gwp || 0,
        ubp: material.ubp || 0,
        penre: material.penre || 0,
        kbobMatch: material.kbobMatch, // Include KBOB match data!
      })),
      _count: {
        uploads: data._count?.uploads || data.uploads?.length || 0,
        elements: data._count?.elements || data.elementCount || data.elements?.length || 0,
        materials: data._count?.materials || uniqueMaterials.size || data.materials?.length || 0,
      },
    };
  }, []);

  const fetchProject = useCallback(async () => {
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
  }, [projectId, transformProjectData]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  const handlePrepareExport = async () => {
    const usePagination = project?.usePagination;

    // For small projects or if we already have all elements, open modal directly
    if (!usePagination || fullElementsData) {
      setIsExportModalOpen(true);
      return;
    }

    // For large projects, fetch all elements first with loading feedback
    setIsLoadingExportData(true);
    try {
      toast({
        title: "Preparing export data",
        description: `Loading ${project.elementCount} elements for export...`,
      });

      // Fetch all elements (this will be slow but only when user needs export)
      const response = await fetch(`/api/projects/${projectId}?includeAllElements=true`);
      if (!response.ok) {
        throw new Error("Failed to load export data");
      }

      const fullData = await response.json();
      setFullElementsData(fullData.elements);

      toast({
        title: "Ready to export",
        description: "All element data loaded successfully",
      });

      setIsExportModalOpen(true);
    } catch (error) {
      console.error("Error loading export data:", error);
      toast({
        title: "Error",
        description: "Failed to load export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExportData(false);
    }
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

  const handleDeleteUploadClick = async (uploadId: string) => {
    setUploadToDelete(uploadId);
    try {
      // Fetch impact preview
      const response = await fetch(`/api/uploads/${uploadId}/impact`);
      if (response.ok) {
        const impact = await response.json();
        setUploadDeleteImpact(impact);
      }
    } catch (error) {
      console.error("Failed to fetch upload impact:", error);
    }
    setIsDeleteUploadDialogOpen(true);
  };

  const handleDeleteUpload = async () => {
    if (!uploadToDelete) return;

    try {
      const response = await fetch(`/api/uploads/${uploadToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete upload");
      }

      const result = await response.json();

      toast({
        title: "Upload deleted",
        description: `Successfully deleted ${result.elementsDeleted} elements.`,
      });

      setIsDeleteUploadDialogOpen(false);
      setUploadToDelete(null);
      setUploadDeleteImpact(null);

      // Refresh project data
      await fetchProject();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the upload. Please try again.",
        variant: "destructive",
      });
    }
  };

  const elementExportData = useMemo(() => {
    if (!project) {
      return {
        results: {} as ElementLcaResultsMap,
        names: {} as Record<string, string>,
      };
    }

    const results: ElementLcaResultsMap = {};
    const names: Record<string, string> = {};

    // Use fullElementsData if available (for large projects), otherwise use project.elements
    const elementsToProcess = fullElementsData || project.elements;

    elementsToProcess.forEach((element: ElementWithMaterials) => {
      if (!element.guid) {
        return;
      }

      const materials = element.materials || [];

      const totals = materials.reduce(
        (acc, mat) => {
          const volume = toFiniteNumber(mat.volume);
          const density = toFiniteNumber(mat.material?.density);
          const mass = volume * density;

          const kbobMatch: KBOBIndicatorValues =
            (mat.material?.kbobMatch && typeof mat.material.kbobMatch === 'object')
              ? mat.material.kbobMatch
              : {};

          const gwp = resolveIndicator(
            mat.indicators?.gwp,
            mass * getGWP(kbobMatch)
          );
          const ubp = resolveIndicator(
            mat.indicators?.ubp,
            mass * getUBP(kbobMatch)
          );
          const penre = resolveIndicator(
            mat.indicators?.penre,
            mass * getPENRE(kbobMatch)
          );

          acc.gwp += gwp;
          acc.ubp += ubp;
          acc.penre += penre;
          return acc;
        },
        { gwp: 0, ubp: 0, penre: 0 }
      );

      // Collect KBOB material names and IDs (deduplicated)
      const materialNames = Array.from(new Set(
        materials
          .map(mat => {
            if (mat.material?.kbobMatch && typeof mat.material.kbobMatch === 'object') {
              return mat.material.kbobMatch.Name;
            }
            return mat.material?.name;
          })
          .filter(Boolean)
      )).join(', ');

      const materialIds = Array.from(new Set(
        materials
          .map(mat => {
            if (mat.material?.kbobMatch && typeof mat.material.kbobMatch === 'object') {
              return mat.material.kbobMatch.KBOB_ID?.toString();
            }
            return mat.material?._id;
          })
          .filter(Boolean)
      )).join(', ');

      results[element.guid] = {
        gwp: toFiniteNumber(totals.gwp),
        penre: toFiniteNumber(totals.penre),
        ubp: toFiniteNumber(totals.ubp),
        MaterialName: materialNames,
        MaterialID: materialIds,
      };
      names[element.guid] = element.name;
    });

    return { results, names };
  }, [project, fullElementsData]);

  const canExport = Object.keys(elementExportData.results).length > 0 || Boolean(project?.usePagination);

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
        onExport={handlePrepareExport}
        canExport={canExport}
        isLoadingExport={isLoadingExportData}
      />
      <ProjectOverview project={project} />
      <ProjectTabs
        project={project}
        onUpload={() => setIsUploadModalOpen(true)}
        onExport={handlePrepareExport}
        canExport={canExport}
        isLoadingExport={isLoadingExportData}
        materialsWithCount={materialsWithCount}
        onDeleteUpload={handleDeleteUploadClick}
      />
      <UploadModal
        projectId={projectId}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onSuccess={handleUploadComplete}
      />
      <ExportIfcModal
        projectName={project.name}
        open={isExportModalOpen}
        onOpenChange={(open) => setIsExportModalOpen(open)}
        elementResults={elementExportData.results}
        elementNames={elementExportData.names}
      />
      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDelete={handleDeleteProject}
      />
      <DeleteUploadDialog
        isOpen={isDeleteUploadDialogOpen}
        onClose={() => {
          setIsDeleteUploadDialogOpen(false);
          setUploadToDelete(null);
          setUploadDeleteImpact(null);
        }}
        onDelete={handleDeleteUpload}
        upload={uploadToDelete ? project?.uploads?.find(u => u._id === uploadToDelete) || null : null}
        impact={uploadDeleteImpact}
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
  onExport,
  canExport,
  isLoadingExport = false,
}: {
  project: ExtendedProject;
  onUpload: () => void;
  onEdit: () => void;
  onExport: () => void;
  canExport: boolean;
  isLoadingExport?: boolean;
}) => {
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [areaValue, setAreaValue] = useState(project.calculationArea?.value?.toString() || '');
  const [areaType, setAreaType] = useState(project.calculationArea?.type || 'EBF');

  const handleSaveArea = async () => {
    const value = parseFloat(areaValue);
    if (isNaN(value) || value < 0) return;

    try {
      await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationArea: { type: areaType, value, unit: 'm²' }
        }),
      });

      setIsEditingArea(false);
      window.location.reload(); // Trigger refetch
    } catch (error) {
      console.error('Failed to save area:', error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label>{areaType} (m²):</Label>
          {isEditingArea ? (
            <div className="flex gap-2 items-center">
              <Select value={areaType} onValueChange={setAreaType}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EBF">EBF</SelectItem>
                  <SelectItem value="GFA">GFA</SelectItem>
                  <SelectItem value="NFA">NFA</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
                onBlur={handleSaveArea}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveArea()}
                className="w-32"
                autoFocus
              />
            </div>
          ) : (
            <span
              onClick={() => setIsEditingArea(true)}
              className="cursor-pointer hover:underline"
            >
              {project.calculationArea?.value || 'Not set'}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          variant="secondary"
          onClick={onExport}
          disabled={!canExport || isLoadingExport}
        >
          {isLoadingExport ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export IFC
            </>
          )}
        </Button>
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
};

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
  onExport,
  canExport,
  isLoadingExport = false,
  materialsWithCount,
  onDeleteUpload,
}: {
  project: Project;
  onUpload: () => void;
  onExport: () => void;
  canExport: boolean;
  isLoadingExport?: boolean;
  materialsWithCount: {
    id: string;
    name: string;
    category?: string;
    volume?: number;
  }[];
  onDeleteUpload: (uploadId: string) => void;
}) => (
  <Tabs defaultValue="uploads" className="w-full">
    <TabsList className="grid w-full grid-cols-4">
      <TabsTrigger value="uploads">Uploads</TabsTrigger>
      <TabsTrigger value="elements">Elements</TabsTrigger>
      <TabsTrigger value="materials">Materials</TabsTrigger>
      <TabsTrigger value="graph">Charts</TabsTrigger>
    </TabsList>

    <TabsContent value="uploads" className="space-y-4">
      <UploadsTab
        project={project}
        onUpload={onUpload}
        onExport={onExport}
        canExport={canExport}
        isLoadingExport={isLoadingExport}
        onDeleteUpload={onDeleteUpload}
      />
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
  onExport,
  canExport,
  isLoadingExport = false,
  onDeleteUpload,
}: {
  project: Project;
  onUpload: () => void;
  onExport: () => void;
  canExport: boolean;
  isLoadingExport?: boolean;
  onDeleteUpload: (uploadId: string) => void;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          Uploads{" "}
          <Badge variant="secondary" className="ml-2">
            {project?.uploads?.length || 0}
          </Badge>
        </h2>
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
              <UploadCard key={upload._id} upload={upload} onDelete={onDeleteUpload} />
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

const UploadCard = ({ upload, onDelete }: { upload: Upload; onDelete: (uploadId: string) => void }) => (
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(upload._id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
);

const ElementsTab = ({ project }: { project: Project }) => {
  const [elements, setElements] = useState<any[]>(project.elements || []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const usePagination = project.usePagination || false;
  const totalElements = project.elementCount || project.elements?.length || 0;

  // Fetch paginated elements for large projects
  useEffect(() => {
    if (usePagination) {
      async function fetchElements() {
        setIsLoading(true);
        try {
          const response = await fetch(
            `/api/projects/${project.id}/elements?page=${page}&limit=50`
          );
          const data = await response.json();
          setElements(data.elements);
          setTotalPages(data.totalPages);
        } catch (error) {
          console.error("Failed to fetch elements:", error);
        } finally {
          setIsLoading(false);
        }
      }
      fetchElements();
    }
  }, [page, usePagination, project.id]);

  const data = useMemo(() => {
    return elements.map((element) => ({
      ...element,
      id: element._id,
    }));
  }, [elements]);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          Elements{" "}
          <Badge variant="secondary" className="ml-2">
            {totalElements}
          </Badge>
        </h2>
      </div>
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Loading elements...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DataTable columns={elementsColumns} data={data} />
            {usePagination && totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => page > 1 && setPage(page - 1)}
                        className={
                          page === 1 ? "pointer-events-none opacity-50" : ""
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + Math.max(1, page - 2);
                      if (pageNum > totalPages) return null;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => page < totalPages && setPage(page + 1)}
                        className={
                          page === totalPages ? "pointer-events-none opacity-50" : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Page {page} of {totalPages} ({totalElements} total elements)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

const MaterialsTab = ({ project }: { project: Project }) => {
  const usePagination = project.usePagination || false;

  const data = useMemo(() => {
    // For large projects with pagination, materials are already aggregated from API
    if (usePagination && project.materials) {
      return project.materials.map((mat: any) => ({
        _id: mat._id,
        material: mat,
        volume: mat.volume || 0,
        emissions: {
          gwp: (mat.volume || 0) * (mat.density || 0) * getGWP(mat.kbobMatch),
          ubp: (mat.volume || 0) * (mat.density || 0) * getUBP(mat.kbobMatch),
          penre: (mat.volume || 0) * (mat.density || 0) * getPENRE(mat.kbobMatch),
        },
      }));
    }

    // For small projects, calculate from elements
    const materialGroups = project.elements.reduce((acc, element) => {
      element.materials.forEach((mat: MaterialWithVolume) => {
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
          getGWP(mat.material.kbobMatch);
        acc[key].emissions.ubp +=
          mat.volume *
          (mat.material.density || 0) *
          getUBP(mat.material.kbobMatch);
        acc[key].emissions.penre +=
          mat.volume *
          (mat.material.density || 0) *
          getPENRE(mat.material.kbobMatch);
      });
      return acc;
    }, {} as Record<string, Material>);

    return Object.values(materialGroups);
  }, [project, usePagination]);

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
          <DataTable columns={materialsColumns} data={data as any[]} />
        </CardContent>
      </Card>
    </>
  );
};

const GraphTab = ({ project }: { project: Project }) => {
  const usePagination = project.usePagination || false;

  // For large projects with pagination, use material-based chart data
  if (usePagination) {
    const materialsData = (project.materials || []).map((mat: any) => ({
      name: mat.name,
      elementName: mat.name, // Add missing elementName property
      ifcMaterial: mat.name,
      kbobMaterial: mat.kbobMatch?.Name || "Unknown",
      category: mat.category || "Uncategorized",
      volume: mat.volume || 0,
      indicators: {
        gwp: (mat.volume || 0) * (mat.density || 0) * getGWP(mat.kbobMatch),
        ubp: (mat.volume || 0) * (mat.density || 0) * getUBP(mat.kbobMatch),
        penre: (mat.volume || 0) * (mat.density || 0) * getPENRE(mat.kbobMatch),
      },
    }));

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
  }

  // For small projects, use element-based chart data
  const materialsData = project.elements.flatMap((element) =>
    // Create one entry per element-material combination
    element.materials.map((material: MaterialWithVolume) => ({
      name: element.name, // Element name from elements table
      elementName: element.name, // Explicit element name for grouping
      ifcMaterial: material.material?.name || "Unknown",
      kbobMaterial: material.material?.kbobMatch?.Name,
      category: element.type, // Ifc entity type
      volume: material.volume, // Use individual material volume
      indicators: {
        gwp:
          material.volume *
          (material.material?.density || 0) *
          getGWP(material.material?.kbobMatch),
        ubp:
          material.volume *
          (material.material?.density || 0) *
          getUBP(material.material?.kbobMatch),
        penre:
          material.volume *
          (material.material?.density || 0) *
          getPENRE(material.material?.kbobMatch),
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
          onClick={onDelete}
        >
          Delete Project
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const DeleteUploadDialog = ({
  isOpen,
  onClose,
  onDelete,
  upload,
  impact,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  upload: Upload | null;
  impact: any;
}) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Upload?</AlertDialogTitle>
        <AlertDialogDescription>
          <div className="space-y-2">
            <p>
              This will permanently delete the upload <strong>{upload?.filename}</strong> and all associated elements.
            </p>
            {impact && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium">Impact:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>{impact.impact?.elementsToDelete || 0} elements will be deleted</li>
                  {impact.impact?.materialsToDelete > 0 && (
                    <li>{impact.impact.materialsToDelete} unused materials will be removed</li>
                  )}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              This action cannot be undone.
            </p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={onDelete}
        >
          Delete Upload
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
