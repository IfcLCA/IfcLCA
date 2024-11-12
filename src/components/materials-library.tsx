"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowUpDown, Filter, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckIcon,
  CaretSortIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [open, setOpen] = useState(false);
  const [kbobValue, setKbobValue] = useState("");
  const [matchedMaterials, setMatchedMaterials] = useState<{
    [key: string]: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "projects">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobSearchTerm, setKbobSearchTerm] = useState("");
  const filteredKbobMaterials = useMemo(() => {
    console.log("Filtering KBOB materials:", kbobMaterials);
    return kbobMaterials.filter((material) =>
      material.Name?.toLowerCase().includes(kbobSearchTerm.toLowerCase())
    );
  }, [kbobMaterials, kbobSearchTerm]);

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
      .filter((material) =>
        material.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
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
  }, [materials, searchTerm, sortColumn, sortDirection]);

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

        // Update local state with the matched material name
        const matchedKbobMaterial = kbobMaterials.find(
          (m) => m._id === kbobValue
        );
        if (matchedKbobMaterial) {
          const newMatches = { ...matchedMaterials };
          selectedMaterials.forEach((materialId) => {
            newMatches[materialId] = matchedKbobMaterial.Name;
          });
          setMatchedMaterials(newMatches);
        }

        // Reset selection state
        setKbobValue("");
        setSelectedMaterials([]);

        // Refresh materials list to show updated matches
        const materialsResponse = await fetch("/api/materials");
        if (materialsResponse.ok) {
          const updatedMaterials = await materialsResponse.json();
          setMaterials(updatedMaterials);
        }
      } catch (error) {
        console.error("Failed to match materials:", error);
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

  if (isLoading) {
    return (
      <Card className="w-[90%] mx-auto">
        <CardHeader>
          <CardTitle>Material Library</CardTitle>
          <CardDescription>Loading materials...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-[90%] mx-auto">
        <CardHeader>
          <CardTitle>Material Library</CardTitle>
          <CardDescription className="text-red-500">
            Error: {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-[90%] mx-auto">
      <CardHeader>
        <CardTitle>Material Library</CardTitle>
        <CardDescription>
          Match project materials with KBOB environmental indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
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
                  <TableCell>{material.volume?.toFixed(2) || "N/A"}</TableCell>
                  <TableCell>
                    {material.kbobMatch ? (
                      <Badge variant="outline">{material.kbobMatch.Name}</Badge>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span>
              Page {currentPage} of{" "}
              {Math.ceil(filteredAndSortedMaterials.length / itemsPerPage)}
            </span>
            <Button
              onClick={() =>
                setCurrentPage((prev) =>
                  Math.min(
                    prev + 1,
                    Math.ceil(filteredAndSortedMaterials.length / itemsPerPage)
                  )
                )
              }
              disabled={
                currentPage ===
                Math.ceil(filteredAndSortedMaterials.length / itemsPerPage)
              }
            >
              Next
            </Button>
          </div>
          <span>{filteredAndSortedMaterials.length} materials</span>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Search KBOB materials..."
            value={kbobSearchTerm}
            onChange={(e) => setKbobSearchTerm(e.target.value)}
            className="w-[300px]"
          />
          <div className="flex items-center space-x-2">
            <Select
              value={kbobValue}
              onValueChange={setKbobValue}
              disabled={selectedMaterials.length === 0}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select KBOB material...">
                  {kbobValue
                    ? kbobMaterials.find((m) => m._id === kbobValue)?.Name
                    : "Select KBOB material..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredKbobMaterials.map((material) => (
                  <SelectItem key={material._id} value={material._id}>
                    {material.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleMatch}
              disabled={!kbobValue || selectedMaterials.length === 0}
            >
              Match Selected
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
