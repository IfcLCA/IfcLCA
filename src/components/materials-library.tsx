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
  const [projects, setProjects] = useState<Array<{id: string; name: string; materialIds: string[]}>>([]);
  const [isMatchingInProgress, setIsMatchingInProgress] = useState(false);
  const [isKbobOpen, setIsKbobOpen] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [favoriteMaterials, setFavoriteMaterials] = useState<string[]>([]);
  const [selectedKbobId, setSelectedKbobId] = useState<string | null>(null);
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
    if (selectedKbobId && selectedMaterials.length > 0) {
      try {
        setIsMatchingInProgress(true);
        
        // First get the preview
        const previewResponse = await fetch("/api/materials/match/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            materialIds: selectedMaterials,
            kbobMaterialId: selectedKbobId,
          }),
        });

        if (!previewResponse.ok) {
          throw new Error("Failed to get match preview");
        }

        const previewData = await previewResponse.json();
        
        // Log for debugging
        console.log('Preview response:', previewData);
        
        // Ensure projects array is properly populated
        const enhancedChanges = previewData.changes.map((change: any) => ({
          ...change,
          projects: projects
            .filter(p => p.materialIds.includes(change.materialId))
            .map(p => p.id)
        }));
        
        // Log enhanced changes
        console.log('Enhanced changes:', enhancedChanges);
        
        setPreviewChanges(enhancedChanges);
        setShowPreview(true);
      } catch (error) {
        console.error("Failed to get match preview:", error);
        alert('Failed to get match preview. Please try again.');
      } finally {
        setIsMatchingInProgress(false);
      }
    }
  };

  const handleConfirmMatch = async () => {
    try {
      setIsMatchingInProgress(true);
      const response = await fetch("/api/materials/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          materialIds: selectedMaterials,
          kbobMaterialId: selectedKbobId,
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
      setIsMatchingInProgress(false);
    }
  };

  const handleCancelMatch = () => {
    setShowPreview(false);
    setPreviewChanges([]);
    setIsMatchingInProgress(false);
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

  const handleNavigateToProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
    handleCancelMatch(); // Close the preview modal
  };

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <ReloadIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle> </CardTitle>
                  <CardDescription>
                    Manage and update your material properties
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search materials..."
                      className="pl-7 w-[180px] h-8 text-sm"
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
              </div>

              <div className="flex gap-4 mb-4">
                <div className="relative flex-1" ref={dropdownRef}>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                      <MagnifyingGlassIcon className="w-4 h-4" />
                      <span>Search and apply environmental impact data</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Search KBOB materials to match..."
                          value={kbobMaterials.find(m => m._id === selectedKbobId)?.Name || kbobSearchTerm}
                          onChange={(e) => {
                            const value = e.target.value;
                            setKbobSearchTerm(value);
                            setSelectedKbobId(""); // Clear selected ID when user types
                            setIsKbobOpen(true);
                          }}
                          onFocus={() => {
                            setKbobSearchTerm("");
                            setSelectedKbobId(""); // Clear selected ID on focus
                            setIsKbobOpen(true);
                          }}
                          onKeyDown={(e) => {
                            const filteredMaterials = sortedKbobMaterials.filter((material) =>
                              material.Name?.toLowerCase().includes(kbobSearchTerm.toLowerCase())
                            );
                            const currentIndex = filteredMaterials.findIndex(
                              (material) => material._id === selectedKbobId
                            );

                            switch (e.key) {
                              case "ArrowDown":
                                e.preventDefault();
                                if (currentIndex < filteredMaterials.length - 1) {
                                  setSelectedKbobId(filteredMaterials[currentIndex + 1]._id);
                                } else {
                                  setSelectedKbobId(filteredMaterials[0]._id);
                                }
                                break;
                              case "ArrowUp":
                                e.preventDefault();
                                if (currentIndex > 0) {
                                  setSelectedKbobId(filteredMaterials[currentIndex - 1]._id);
                                } else {
                                  setSelectedKbobId(filteredMaterials[filteredMaterials.length - 1]._id);
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
                        {isKbobOpen && (
                          <div className="absolute z-50 w-full max-h-[300px] overflow-y-auto bg-background border rounded-md shadow-lg mt-2">
                            {/* Suggestions */}
                            {!selectedKbobId && kbobSearchTerm.length >= 2 && (
                              <div className="p-2 border-b">
                                {getSuggestions(kbobSearchTerm).map(({ type, text, id }, index) => (
                                  <div
                                    key={`${type}-${text}`}
                                    className="flex items-center gap-2 p-1 cursor-pointer hover:bg-primary/10 rounded"
                                    onClick={() => {
                                      if (id) {
                                        // If it's a favorite with an ID, set both the ID and search term
                                        setSelectedKbobId(id);
                                        setKbobSearchTerm(text);
                                        setIsKbobOpen(false);
                                      } else {
                                        // For phrases and words, just set the search term
                                        setKbobSearchTerm(text);
                                      }
                                    }}
                                  >
                                    {type === 'favorite' && <StarFilledIcon className="w-3 h-3 text-yellow-400" />}
                                    {type === 'phrase' && <MagnifyingGlassIcon className="w-3 h-3 text-muted-foreground" />}
                                    <span className="text-sm">{text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Material matches */}
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
                                    className={`p-2 hover:bg-primary/10 cursor-pointer ${
                                      material._id === selectedKbobId ? "bg-primary/10" : ""
                                    }`}
                                  >
                                    <div className="flex justify-between items-center gap-2">
                                      <span 
                                        className="flex-1"
                                        onClick={() => {
                                          setSelectedKbobId(material._id);
                                          setKbobSearchTerm(material.Name || "");
                                          setIsKbobOpen(false);
                                        }}
                                      >
                                        <div className="font-medium">{material.Name}</div>
                                        <div className="text-sm text-muted-foreground">
                                          GWP: {material.GWP} kg CO₂-eq
                                        </div>
                                      </span>
                                      <button
                                        className="p-1 hover:bg-primary/20 rounded"
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
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleMatch}
                        disabled={
                          !selectedKbobId ||
                          selectedMaterials.length === 0 ||
                          isMatchingInProgress
                        }
                        className="h-10"
                      >
                        {isMatchingInProgress ? (
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
                  </div>
                </div>
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
            </>
          )}
        </CardContent>
      </Card>
      <MaterialChangesPreviewModal
        isOpen={showPreview}
        onClose={handleCancelMatch}
        onConfirm={handleConfirmMatch}
        onNavigateToProject={handleNavigateToProject}
        changes={previewChanges}
      />
    </>
  );
}
