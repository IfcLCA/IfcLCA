"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
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
import { MaterialChangesPreviewModal } from "@/components/material-changes-preview-modal";

interface Material {
  id: string;
  name: string;
  category?: string;
  volume?: number;
  kbobMatchId?: string;
  kbobMatch?: {
    id: string;
    Name: string;
    GWP: number;
    UBP: number;
    PENRE: number;
  };
  projects?: string[];
}

interface KbobMaterial {
  _id: string;
  KBOB_ID: number;
  Name: string;
  GWP: number;
  UBP: number;
  PENRE: number;
}

interface Project {
  id: string;
  name: string;
  materialIds: string[];
}

export function MaterialLibraryComponent() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "projects">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobSearchTerm, setKbobSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{id: string; name: string; materialIds: string[]}>>([]);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const [isKbobOpen, setIsKbobOpen] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [materialsRes, kbobRes, projectsRes] = await Promise.all([
          fetch('/api/materials'),
          fetch('/api/kbob'),
          fetch('/api/materials/projects')
        ]);

        if (!materialsRes.ok || !kbobRes.ok || !projectsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [materialsData, kbobData, projectsData] = await Promise.all([
          materialsRes.json(),
          kbobRes.json(),
          projectsRes.json()
        ]);

        // Initialize materials with empty array if undefined
        setMaterials(Array.isArray(materialsData) ? materialsData : []);
        setKbobMaterials(kbobData);
        setProjects(projectsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredAndSortedMaterials = useMemo(() => {
    // Ensure materials is an array
    const materialsList = Array.isArray(materials) ? materials : [];
    
    let filtered = [...materialsList];

    if (selectedProject) {
      // When a specific project is selected, show all materials for that project
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        filtered = filtered.filter(material => 
          project.materialIds.includes(material.id)
        );
      }
    } else {
      // For "All Projects" view, group materials by name and KBOB match
      const groupedMaterials = new Map<string, Material & { originalIds: string[] }>();
      
      filtered.forEach(material => {
        const key = `${material.name}-${material.kbobMatchId || 'unmatched'}`;
        
        if (!groupedMaterials.has(key)) {
          // Keep the first occurrence of the material with all related IDs
          groupedMaterials.set(key, {
            ...material,
            originalIds: [material.id],
            projects: projects
              .filter(p => p.materialIds.includes(material.id))
              .map(p => p.name)
          });
        } else {
          // Update existing material group
          const existingMaterial = groupedMaterials.get(key)!;
          existingMaterial.originalIds.push(material.id);
          
          const projectsForThisMaterial = projects
            .filter(p => p.materialIds.includes(material.id))
            .map(p => p.name);
          
          existingMaterial.projects = Array.from(new Set([
            ...(existingMaterial.projects || []),
            ...projectsForThisMaterial
          ]));
        }
      });
      
      filtered = Array.from(groupedMaterials.values());
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(material =>
        material.name.toLowerCase().includes(term) ||
        material.category?.toLowerCase().includes(term) ||
        material.kbobMatch?.Name.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      if (sortColumn === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [materials, searchTerm, sortColumn, sortDirection, selectedProject, projects]);

  const getMaterialProjects = useCallback((materialId: string) => {
    return projects
      .filter(project => project.materialIds.includes(materialId))
      .map(project => project.name)
      .join(", ");
  }, [projects]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMaterials.slice(
      startIndex,
      startIndex + itemsPerPage
    );
  }, [filteredAndSortedMaterials, currentPage, itemsPerPage]);

  const handleSelect = (material: Material & { originalIds?: string[] }) => {
    // If material has originalIds (grouped view), select all related IDs
    const idsToSelect = material.originalIds || [material.id];
    
    setSelectedMaterials((prev) => {
      const allSelected = idsToSelect.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !idsToSelect.includes(id));
      } else {
        return [...prev, ...idsToSelect.filter(id => !prev.includes(id))];
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Get all IDs including those from grouped materials
      const allIds = paginatedMaterials.flatMap(material => 
        material.originalIds || [material.id]
      );
      setSelectedMaterials(allIds);
    } else {
      setSelectedMaterials([]);
    }
  };

  const isSelected = (material: Material & { originalIds?: string[] }) => {
    const idsToCheck = material.originalIds || [material.id];
    return idsToCheck.some(id => selectedMaterials.includes(id));
  };

  const handleMatch = async () => {
    if (kbobSearchTerm && selectedMaterials.length > 0) {
      try {
        setIsMatchingLoading(true);
        
        // First get the preview
        const previewResponse = await fetch("/api/materials/match/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            materialIds: selectedMaterials,
            kbobMaterialId: kbobSearchTerm,
          }),
        });

        if (!previewResponse.ok) {
          throw new Error("Failed to get match preview");
        }

        const previewData = await previewResponse.json();
        setPreviewChanges(previewData.changes);
        setShowPreview(true);
        setIsMatchingLoading(false);
      } catch (error) {
        console.error("Failed to get match preview:", error);
        setIsMatchingLoading(false);
      }
    }
  };

  const handleConfirmMatch = async () => {
    try {
      setIsMatchingLoading(true);
      const response = await fetch("/api/materials/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          materialIds: selectedMaterials,
          kbobMaterialId: kbobSearchTerm,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to match materials");
      }

      // Fetch updated materials to ensure we have the latest state
      const materialsResponse = await fetch('/api/materials');
      if (!materialsResponse.ok) {
        throw new Error("Failed to fetch updated materials");
      }
      const updatedMaterials = await materialsResponse.json();
      
      // Ensure we're setting an array
      setMaterials(Array.isArray(updatedMaterials) ? updatedMaterials : []);

      // Reset states
      setKbobSearchTerm("");
      setSelectedMaterials([]);
      setShowPreview(false);
      setPreviewChanges([]);
    } catch (error) {
      console.error("Failed to match materials:", error);
    } finally {
      setIsMatchingLoading(false);
    }
  };

  const handleCancelMatch = () => {
    setShowPreview(false);
    setPreviewChanges([]);
    setIsMatchingLoading(false);
  };

  const toggleSort = (column: "name" | "projects") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const allProjects = useMemo(() => {
    const projectSet = new Set<string>();
    materials.forEach((material) =>
      material.projects?.forEach((project) => projectSet.add(project))
    );
    return Array.from(projectSet).sort();
  }, [materials]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsKbobOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (isLoading) {
    return <div className="mt-8">Loading materials...</div>;
  }

  if (error) {
    return <div className="mt-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Material Library</CardTitle>
          <CardDescription>
            Manage and update your material properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={selectedProject || "all"}
              onValueChange={(value) => setSelectedProject(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative flex-1" ref={dropdownRef}>
              <div className="flex items-center space-x-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search and apply environmental impact data..."
                  value={kbobSearchTerm}
                  onChange={(e) => {
                    setKbobSearchTerm(e.target.value);
                    setIsKbobOpen(true);
                  }}
                  onFocus={() => {
                    setKbobSearchTerm("");
                    setIsKbobOpen(true);
                  }}
                  onKeyDown={(e) => {
                    const filteredMaterials = kbobMaterials.filter((material) =>
                      material.Name?.toLowerCase().includes(kbobSearchTerm.toLowerCase())
                    );
                    const currentIndex = filteredMaterials.findIndex(
                      (material) => material._id === kbobSearchTerm
                    );

                    switch (e.key) {
                      case "ArrowDown":
                        e.preventDefault();
                        if (currentIndex < filteredMaterials.length - 1) {
                          setKbobSearchTerm(filteredMaterials[currentIndex + 1]._id);
                        } else {
                          setKbobSearchTerm(filteredMaterials[0]._id);
                        }
                        break;
                      case "ArrowUp":
                        e.preventDefault();
                        if (currentIndex > 0) {
                          setKbobSearchTerm(filteredMaterials[currentIndex - 1]._id);
                        } else {
                          setKbobSearchTerm(filteredMaterials[filteredMaterials.length - 1]._id);
                        }
                        break;
                      case "Enter":
                        if (currentIndex !== -1) {
                          e.preventDefault();
                          setIsKbobOpen(false);
                        }
                        break;
                      case "Escape":
                        e.preventDefault();
                        setIsKbobOpen(false);
                        break;
                    }
                  }}
                  className="w-full"
                />
              </div>
              {isKbobOpen && (
                <div className="absolute z-50 w-full max-h-[300px] overflow-y-auto bg-background border rounded-md shadow-lg mt-2">
                  {kbobMaterials
                    .filter((material) =>
                      material.Name?.toLowerCase().includes(kbobSearchTerm.toLowerCase())
                    )
                    .map((material) => (
                      <div
                        key={material._id}
                        className={`p-2 hover:bg-primary/10 cursor-pointer flex justify-between items-center ${
                          material._id === kbobSearchTerm ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          setKbobSearchTerm(material._id);
                          setIsKbobOpen(false);
                        }}
                      >
                        <span className="flex-1">{material.Name}</span>
                        <span className="text-sm text-muted-foreground ml-4">
                          GWP: {material.GWP}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleMatch}
              disabled={
                !kbobSearchTerm ||
                selectedMaterials.length === 0 ||
                isMatchingLoading
              }
            >
              {isMatchingLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Matching...
                </>
              ) : (
                "Match Selected"
              )}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]">
                  <Checkbox
                    checked={
                      selectedMaterials.length === filteredAndSortedMaterials.length
                    }
                    onCheckedChange={(checked) => {
                      handleSelectAll(checked);
                    }}
                  />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSort("name")}
                  >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>KBOB Match</TableHead>
                <TableHead>Projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMaterials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="w-12">
                    <Checkbox
                      checked={isSelected(material)}
                      onCheckedChange={() => handleSelect(material)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  <TableCell>{material.name}</TableCell>
                  <TableCell>{material.category || "-"}</TableCell>
                  <TableCell>{material.volume?.toFixed(2) || "-"}</TableCell>
                  <TableCell>
                    {material.kbobMatch ? (
                      <Badge variant="outline">
                        {material.kbobMatch.Name}
                      </Badge>
                    ) : (
                      "Not matched"
                    )}
                  </TableCell>
                  <TableCell>
                    {material.projects?.join(", ") || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
            <div className="flex items-center gap-2">
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(
                    value === "all"
                      ? filteredAndSortedMaterials.length
                      : Number(value)
                  );
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 40, 80, "all"].map((size) => (
                    <SelectItem key={size.toString()} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(
                  currentPage * itemsPerPage,
                  filteredAndSortedMaterials.length
                )}{" "}
                of {filteredAndSortedMaterials.length}
              </span>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) => Math.max(prev - 1, 1));
                    }}
                    aria-disabled={currentPage === 1}
                  />
                </PaginationItem>
                {Array.from({
                  length: Math.min(
                    5,
                    Math.ceil(filteredAndSortedMaterials.length / itemsPerPage)
                  ),
                }).map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(index + 1);
                      }}
                      isActive={currentPage === index + 1}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) =>
                        Math.min(
                          prev + 1,
                          Math.ceil(
                            filteredAndSortedMaterials.length / itemsPerPage
                          )
                        )
                      );
                    }}
                    aria-disabled={
                      currentPage ===
                      Math.ceil(
                        filteredAndSortedMaterials.length / itemsPerPage
                      )
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
      <MaterialChangesPreviewModal
        isOpen={showPreview}
        onClose={handleCancelMatch}
        onConfirm={handleConfirmMatch}
        changes={previewChanges}
      />
    </div>
  );
}
