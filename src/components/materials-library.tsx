"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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

export function MaterialLibraryComponent() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [kbobValue, setKbobValue] = useState("");
  const [matchedMaterials, setMatchedMaterials] = useState<{
    [key: string]: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "projects">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobSearchTerm, setKbobSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const [isKbobOpen, setIsKbobOpen] = useState(false);
  const filteredKbobMaterials = useMemo(() => {
    console.log("Filtering KBOB materials:", kbobMaterials);
    return kbobMaterials.filter((material) =>
      material.Name?.toLowerCase().includes(kbobSearchTerm.toLowerCase())
    );
  }, [kbobMaterials, kbobSearchTerm]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/materials");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched materials:", data);
        setMaterials(data);
      } catch (error) {
        console.error("Failed to fetch materials:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch materials"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchMaterials();
  }, []);

  useEffect(() => {
    async function fetchKbobMaterials() {
      try {
        const response = await fetch("/api/kbob");
        if (!response.ok) throw new Error("Failed to fetch KBOB materials");
        const data = await response.json();
        console.log("Fetched KBOB materials:", data);
        setKbobMaterials(data);
      } catch (error) {
        console.error("Failed to fetch KBOB materials:", error);
      }
    }

    fetchKbobMaterials();
  }, []);

  useEffect(() => {
    const initialMatches: { [key: string]: string } = {};
    materials.forEach((material) => {
      if (material.kbobMatch) {
        initialMatches[material.id] = material.kbobMatch.Name;
      }
    });
    setMatchedMaterials(initialMatches);
  }, [materials]);

  const filteredAndSortedMaterials = useMemo(() => {
    console.log("Filtering materials:", materials.length);

    // Create a Map to store unique materials by name
    const uniqueMaterialsMap = new Map();

    materials.forEach((material) => {
      const existingMaterial = uniqueMaterialsMap.get(material.name);

      if (!existingMaterial) {
        // If material doesn't exist, add it
        uniqueMaterialsMap.set(material.name, material);
      } else {
        // If material exists, sum the volumes
        uniqueMaterialsMap.set(material.name, {
          ...existingMaterial,
          volume: (existingMaterial.volume || 0) + (material.volume || 0),
        });
      }
    });

    // Convert Map back to array and apply filtering/sorting
    return Array.from(uniqueMaterialsMap.values())
      .filter((material) => {
        const nameMatch = material.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const projectMatch =
          !selectedProject || material.projects?.includes(selectedProject);
        return nameMatch && projectMatch;
      })
      .sort((a, b) => {
        if (sortColumn === "name") {
          return sortDirection === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else {
          const aLength = a.projects?.length || 0;
          const bLength = b.projects?.length || 0;
          return sortDirection === "asc"
            ? aLength - bLength
            : bLength - aLength;
        }
      });
  }, [materials, searchTerm, sortColumn, sortDirection, selectedProject]);

  const paginatedMaterials = useMemo(() => {
    console.log("Paginating materials:", filteredAndSortedMaterials.length);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMaterials.slice(
      startIndex,
      startIndex + itemsPerPage
    );
  }, [filteredAndSortedMaterials, currentPage, itemsPerPage]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedMaterials(checked ? paginatedMaterials.map((m) => m.id) : []);
  };

  const handleSelect = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleMatch = async () => {
    if (kbobValue && selectedMaterials.length > 0) {
      try {
        setIsMatchingLoading(true);
        const response = await fetch("/api/materials/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            materialIds: selectedMaterials,
            kbobMaterialId: kbobValue,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to match materials");
        }

        // Wait for the database update to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const matchedKbobMaterial = kbobMaterials.find(
          (m) => m._id === kbobValue
        );

        if (matchedKbobMaterial) {
          // Update materials array with new matches
          setMaterials((prevMaterials) =>
            prevMaterials.map((material) => {
              if (selectedMaterials.includes(material.id)) {
                return {
                  ...material,
                  kbobMatch: {
                    id: matchedKbobMaterial._id,
                    Name: matchedKbobMaterial.Name,
                    GWP: matchedKbobMaterial.GWP,
                    UBP: matchedKbobMaterial.UBP,
                    PENRE: matchedKbobMaterial.PENRE,
                  },
                  kbobMatchId: matchedKbobMaterial._id,
                };
              }
              return material;
            })
          );

          // Update matched materials state
          setMatchedMaterials((prev) => ({
            ...prev,
            ...Object.fromEntries(
              selectedMaterials.map((id) => [id, matchedKbobMaterial.Name])
            ),
          }));
        }

        // Reset selection states
        setKbobValue("");
        setSelectedMaterials([]);
      } catch (error) {
        console.error("Failed to match materials:", error);
      } finally {
        setIsMatchingLoading(false);
      }
    }
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

  if (isLoading) {
    return <div className="mt-8">Loading materials...</div>;
  }

  if (error) {
    return <div className="mt-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
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
                      if (e.target.value.length > 0) {
                        setKbobValue("");
                      }
                    }}
                    onFocus={() => setIsKbobOpen(true)}
                    className="w-full"
                  />
                </div>
                {isKbobOpen && (
                  <div className="absolute z-50 w-full max-h-[300px] overflow-y-auto bg-background border rounded-md shadow-lg mt-2">
                    {filteredKbobMaterials.length > 0 ? (
                      filteredKbobMaterials.map((material) => (
                        <div
                          key={material._id}
                          className="p-2 hover:bg-primary/10 cursor-pointer flex justify-between items-center"
                          onClick={() => {
                            setKbobValue(material._id);
                            setKbobSearchTerm(material.Name);
                            setIsKbobOpen(false);
                          }}
                        >
                          <span className="flex-1">{material.Name}</span>
                          <span className="text-sm text-muted-foreground ml-4">
                            GWP: {material.GWP}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-muted-foreground">
                        No matches found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={handleMatch}
                disabled={
                  !kbobValue ||
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
            {kbobValue && (
              <div className="text-sm text-muted-foreground">
                Selected: {kbobMaterials.find((m) => m._id === kbobValue)?.Name}
              </div>
            )}
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedMaterials.length === paginatedMaterials.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("name")}
                  >
                    Material Name
                    <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Volume (m³)</TableHead>
                  <TableHead>KBOB Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMaterials.includes(material.id)}
                        onCheckedChange={() => handleSelect(material.id)}
                        aria-label={`Select ${material.name}`}
                      />
                    </TableCell>
                    <TableCell>{material.name}</TableCell>
                    <TableCell>{material.category || "N/A"}</TableCell>
                    <TableCell>
                      {material.volume?.toFixed(2) || "N/A"}
                    </TableCell>
                    <TableCell>
                      {material.kbobMatch ? (
                        <Badge variant="outline">
                          {material.kbobMatch.Name}
                        </Badge>
                      ) : (
                        "Not matched"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedMaterials.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No materials found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
    </div>
  );
}
