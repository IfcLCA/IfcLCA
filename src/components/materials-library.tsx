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
import { StarFilledIcon, StarIcon } from "@radix-ui/react-icons";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

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

interface MaterialChange {
  materialId: string;
  materialName: string;
  oldMatch: {
    Name: string;
    Density: number;
    Elements: number;
  } | null;
  newMatch: {
    id: string;
    Name: string;
    Density: number;
    Elements: number;
    hasDensityRange: boolean;
    minDensity?: number;
    maxDensity?: number;
  };
  projects: string[];
  projectId: string | null;
  elements: number;
  selectedDensity?: number;
}

export function MaterialLibraryComponent() {
  const router = useRouter();
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
  const [projects, setProjects] = useState<Array<{ id: string; name: string; materialIds: string[] }>>([]);
  const [isMatchingInProgress, setIsMatchingInProgress] = useState(false);
  const [isKbobOpen, setIsKbobOpen] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<MaterialChange[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [favoriteMaterials, setFavoriteMaterials] = useState<string[]>([]);
  const [selectedKbobId, setSelectedKbobId] = useState<string | null>(null);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [temporaryMatches, setTemporaryMatches] = useState<Record<string, string>>({});
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

        // Check URL parameters for projectId
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('projectId');
        if (projectIdFromUrl) {
          setSelectedProject(projectIdFromUrl);
        }
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
    }

    // Add project names to each material
    filtered = filtered.map(material => ({
      ...material,
      projects: projects
        .filter(project => project.materialIds.includes(material.id))
        .map(project => project.name)
    }));

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

  const handleMatch = (materialIds: string[], kbobId: string | null) => {
    const newMatches = { ...temporaryMatches };
    materialIds.forEach((id) => {
      if (kbobId) {
        newMatches[id] = kbobId;
      } else {
        delete newMatches[id];
      }
    });
    setTemporaryMatches(newMatches);
  };

  const handleConfirmMatch = async (changesWithDensity: MaterialChange[]) => {
    try {
      setIsMatchingInProgress(true);

      // Convert changes into the format expected by the API
      const matchPromises = changesWithDensity.map(async (change) => {
        const response = await fetch("/api/materials/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            materialIds: [change.materialId],
            kbobMaterialId: change.newMatch.id,
            density: change.selectedDensity || change.newMatch.Density
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to match material ${change.materialId}`);
        }
      });

      // Wait for all matches to be applied
      await Promise.all(matchPromises);

      // Refresh materials
      const materialsResponse = await fetch('/api/materials');
      if (!materialsResponse.ok) {
        throw new Error("Failed to fetch updated materials");
      }
      const updatedMaterials = await materialsResponse.json();
      setMaterials(updatedMaterials);

      // Reset states
      setTemporaryMatches({});
      setShowPreview(false);
      setKbobSearchTerm("");
      setActiveSearchId(null);

      // Show success message
      toast({
        title: "Success",
        description: "Material matches have been applied successfully.",
      });
    } catch (error) {
      console.error("Failed to apply matches:", error);
      toast({
        title: "Error",
        description: "Failed to apply matches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMatchingInProgress(false);
    }
  };

  const handleCancelMatch = () => {
    setShowPreview(false);
  };

  const getPreviewChanges = () => {
    return Object.entries(temporaryMatches).map(([materialId, kbobId]) => {
      const material = materials.find(m => m.id === materialId);
      const kbobMaterial = kbobMaterials.find(m => m._id === kbobId);
      if (!material || !kbobMaterial) return null;

      // Get affected projects with both id and name for navigation
      const affectedProjects = projects.filter(p => p.materialIds.includes(materialId));

      // Get the first project ID for navigation (assuming one material belongs to one project)
      const projectId = affectedProjects[0]?.id;

      // Get element count from material
      const elementCount = material.elements?.length || 0;

      // Get the current material's density from the existing match
      const currentDensity = material.density || 0;

      // Check if material has a density range
      const hasDensityRange = typeof kbobMaterial["min density"] === "number" && 
                             typeof kbobMaterial["max density"] === "number";

      // Get the new density from the KBOB material
      const newDensity = typeof kbobMaterial["kg/unit"] === "number" ? 
        kbobMaterial["kg/unit"] : 
        hasDensityRange ?
          (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2 : 
          currentDensity;

      return {
        materialId,
        materialName: material.name,
        oldMatch: material.kbobMatch ? {
          Name: material.kbobMatch.Name,
          Density: currentDensity,
          Elements: elementCount
        } : null,
        newMatch: {
          id: kbobMaterial._id,
          Name: kbobMaterial.Name,
          Density: newDensity,
          Elements: elementCount,
          hasDensityRange,
          minDensity: hasDensityRange ? kbobMaterial["min density"] : undefined,
          maxDensity: hasDensityRange ? kbobMaterial["max density"] : undefined
        },
        projects: affectedProjects.map(p => p.name),
        projectId,
        elements: elementCount
      };
    }).filter(Boolean);
  };

  const handleNavigateToProject = (projectId: string) => {
    if (!projectId) return;
    router.push(`/projects/${projectId}`);
    setShowPreview(false);
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

  const sortedKbobMaterials = useMemo(() => {
    return [...kbobMaterials].sort((a, b) => {
      const aFav = favoriteMaterials.includes(a._id);
      const bFav = favoriteMaterials.includes(b._id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.Name?.localeCompare(b.Name || '') || 0;
    });
  }, [kbobMaterials, favoriteMaterials]);

  const commonWords = useMemo(() => {
    const words = new Map<string, number>();
    kbobMaterials.forEach(material => {
      if (!material.Name) return;
      const wordList = material.Name.split(/[\s,.-]+/).filter(w => w.length > 2);
      wordList.forEach(word => {
        words.set(word.toLowerCase(), (words.get(word.toLowerCase()) || 0) + 1);
      });
    });
    return Array.from(words.entries())
      .filter(([_, count]) => count > 1) // Only keep words that appear more than once
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }, [kbobMaterials]);

  const commonPhrases = useMemo(() => {
    const phrases = new Map<string, number>();
    kbobMaterials.forEach(material => {
      if (!material.Name) return;
      // Get 2-3 word phrases
      const words = material.Name.split(/[\s,.-]+/).filter(w => w.length > 2);
      for (let i = 0; i < words.length - 1; i++) {
        const twoWords = `${words[i]} ${words[i + 1]}`.toLowerCase();
        phrases.set(twoWords, (phrases.get(twoWords) || 0) + 1);
        if (i < words.length - 2) {
          const threeWords = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase();
          phrases.set(threeWords, (phrases.get(threeWords) || 0) + 1);
        }
      }
    });
    // Convert to array and sort by frequency
    return Array.from(phrases.entries())
      .filter(([_, count]) => count > 1) // Only keep phrases that appear more than once
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }, [kbobMaterials]);

  // Normalize text for comparison (handle special characters, case, etc.)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      // Replace special characters with their basic form
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace special characters and punctuation
      .replace(/[^a-z0-9\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getSuggestions = useCallback((input: string) => {
    if (!input || input.length < 2) return [];
    const searchTerm = normalizeText(input);

    // First, get exact favorites matches
    const favoriteMatches = sortedKbobMaterials
      .filter(m => {
        if (!m.Name) return false;
        const normalizedName = normalizeText(m.Name);
        return favoriteMaterials.includes(m._id) &&
          normalizedName.includes(searchTerm);
      })
      .slice(0, 3)
      .map(m => ({ type: 'favorite' as const, text: m.Name, id: m._id }));

    // Then, get phrase suggestions
    const phraseMatches = commonPhrases
      .filter(phrase => normalizeText(phrase).includes(searchTerm))
      .slice(0, 3)
      .map(phrase => ({ type: 'phrase' as const, text: phrase, id: null }));

    // Finally, get word suggestions
    const wordMatches = commonWords
      .filter(word => normalizeText(word).includes(searchTerm))
      .slice(0, 3)
      .map(word => ({ type: 'word' as const, text: word, id: null }));

    return [...favoriteMatches, ...phraseMatches, ...wordMatches];
  }, [commonPhrases, commonWords, sortedKbobMaterials, favoriteMaterials]);

  const toggleFavorite = useCallback((materialId: string) => {
    setFavoriteMaterials(prev => {
      if (prev.includes(materialId)) {
        return prev.filter(id => id !== materialId);
      } else {
        return [...prev, materialId];
      }
    });
  }, []);

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

  const getTemporaryMatch = (materialId: string) => {
    const kbobId = temporaryMatches[materialId];
    if (!kbobId) return null;
    return kbobMaterials.find(material => material._id === kbobId);
  };

  const getMatchingProgress = () => {
    const totalMaterials = filteredAndSortedMaterials.length;
    const matchedCount = filteredAndSortedMaterials.filter(
      material => temporaryMatches[material.id] || material.kbobMatchId
    ).length;
    return { totalMaterials, matchedCount, percentage: (matchedCount / totalMaterials) * 100 };
  };

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <Card className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Materials Library</CardTitle>
            <CardDescription>
              Match your IFC model materials with KBOB environmental impact data
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
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
            <Button
              variant="default"
              onClick={() => setShowPreview(true)}
              disabled={Object.keys(temporaryMatches).length === 0}
            >
              Review & Apply Matches
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6 min-h-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Left Column - IFC Model Materials */}
            <div className="flex flex-col border rounded-lg overflow-hidden h-full">
              <div className="p-4 border-b bg-secondary/10 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span>IFC Model Materials</span>
                    <Badge
                      variant={getMatchingProgress().percentage === 100 ? "success" : "secondary"}
                    >
                      {getMatchingProgress().matchedCount} / {getMatchingProgress().totalMaterials} matched
                    </Badge>
                  </h3>
                </div>
                <div className="w-full bg-secondary/20 rounded-full h-2 mb-3">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getMatchingProgress().percentage}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Select each material from your IFC model and match it with a corresponding KBOB material
                </p>
                <div className="flex items-center gap-2">
                  <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search model materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="divide-y">
                  {paginatedMaterials.map((material) => (
                    <div
                      key={material.id}
                      className={`p-4 hover:bg-secondary/5 transition-colors cursor-pointer ${material.id === activeSearchId ? 'bg-primary/10 hover:bg-primary/15' : ''
                        }`}
                      onClick={() => {
                        setActiveSearchId(material.id === activeSearchId ? null : material.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{material.name}</h3>
                            {material.category && (
                              <Badge variant="outline" className="shrink-0">
                                {material.category}
                              </Badge>
                            )}
                          </div>
                          {material.volume && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Volume: {material.volume.toFixed(2)} m³
                            </p>
                          )}
                          {material.projects && material.projects.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Projects: {material.projects.join(", ")}
                            </p>
                          )}
                          {(temporaryMatches[material.id] || material.kbobMatchId) ? (
                            <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-secondary/20 rounded-md">
                              <div className="flex-1 min-w-0">
                                {temporaryMatches[material.id] ? (
                                  <>
                                    <p className="font-medium text-sm truncate">
                                      {getTemporaryMatch(material.id)?.Name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      GWP: {getTemporaryMatch(material.id)?.GWP} kg CO₂-eq
                                    </p>
                                  </>
                                ) : material.kbobMatch ? (
                                  <>
                                    <p className="font-medium text-sm truncate">
                                      {material.kbobMatch.Name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      GWP: {material.kbobMatch.GWP} kg CO₂-eq
                                    </p>
                                  </>
                                ) : null}
                              </div>
                              {temporaryMatches[material.id] && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatch([material.id], null);
                                  }}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2 p-2 bg-yellow-500/10 text-yellow-600 rounded-md text-sm">
                              Click to match with KBOB material
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t bg-secondary/5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) =>
                            Math.min(prev + 1, Math.ceil(filteredAndSortedMaterials.length / itemsPerPage))
                          )}
                          disabled={currentPage === Math.ceil(filteredAndSortedMaterials.length / itemsPerPage)}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            </div>

            {/* Right Column - KBOB Materials */}
            <div className="flex flex-col border rounded-lg overflow-hidden h-full">
              <div className="p-4 border-b bg-secondary/10 flex-shrink-0">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span>KBOB Materials Database</span>
                  <Badge variant="outline">{kbobMaterials.length} materials</Badge>
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {activeSearchId ?
                    'Select a KBOB material to match with your highlighted IFC material' :
                    'First select an IFC material on the left to match it'
                  }
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search KBOB materials..."
                      value={kbobSearchTerm}
                      onChange={(e) => setKbobSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {kbobSearchTerm.length >= 2 && (
                    <div className="flex flex-wrap gap-1">
                      {getSuggestions(kbobSearchTerm).map(({ type, text, id }) => (
                        <Badge
                          key={`${type}-${text}`}
                          variant="secondary"
                          className={`cursor-pointer hover:bg-secondary/20 ${!activeSearchId ? 'opacity-50' : ''}`}
                          onClick={() => {
                            if (id && activeSearchId) {
                              handleMatch([activeSearchId], id);
                              setActiveSearchId(null);
                            } else {
                              setKbobSearchTerm(text);
                            }
                          }}
                        >
                          {type === 'favorite' && <StarFilledIcon className="w-3 h-3 text-yellow-400 mr-1" />}
                          {type === 'phrase' && <MagnifyingGlassIcon className="w-3 h-3 text-muted-foreground mr-1" />}
                          {text}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="divide-y">
                  {sortedKbobMaterials
                    .filter((material) => {
                      if (!material.Name) return false;
                      return normalizeText(material.Name).includes(
                        normalizeText(kbobSearchTerm)
                      );
                    })
                    .map((material) => (
                      <div
                        key={material._id}
                        className={`p-4 transition-colors ${activeSearchId
                          ? 'hover:bg-primary/5 cursor-pointer'
                          : 'opacity-75'
                          }`}
                        onClick={() => {
                          if (activeSearchId) {
                            handleMatch([activeSearchId], material._id);
                            setActiveSearchId(null);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{material.Name}</h3>
                              <button
                                className="p-1 hover:bg-secondary/20 rounded shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(material._id);
                                }}
                              >
                                {favoriteMaterials.includes(material._id) ? (
                                  <StarFilledIcon className="w-4 h-4 text-yellow-400" />
                                ) : (
                                  <StarIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                            <div className="mt-1 space-y-1">
                              <p className="text-sm text-muted-foreground">
                                GWP: {material.GWP} kg CO₂-eq
                              </p>
                              <p className="text-sm text-muted-foreground">
                                UBP: {material.UBP}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                PENRE: {material.PENRE}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {showPreview && (
        <MaterialChangesPreviewModal
          changes={getPreviewChanges()}
          isOpen={showPreview}
          onClose={handleCancelMatch}
          onConfirm={handleConfirmMatch}
          onNavigateToProject={handleNavigateToProject}
          isLoading={isMatchingInProgress}
        />
      )}
    </Card>
  );
}
