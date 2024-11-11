"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, Filter } from "lucide-react";
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

// Mock data for materials used in projects (expanded)
const projectMaterials = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `Material ${i + 1}`,
  projects: Array.from(
    { length: Math.floor(Math.random() * 5) + 1 },
    (_, j) => `Project ${String.fromCharCode(65 + j)}`
  ),
}));

// Mock data for KBOB materials (expanded)
const kbobMaterials = Array.from({ length: 500 }, (_, i) => ({
  id: i + 1,
  name: `KBOB Material ${i + 1}`,
  category: ["Concrete", "Metals", "Wood", "Insulation", "Finishes"][
    Math.floor(Math.random() * 5)
  ],
}));

export function MaterialLibraryComponent() {
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [matchedMaterials, setMatchedMaterials] = useState<{
    [key: number]: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "projects">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const filteredAndSortedMaterials = useMemo(() => {
    return projectMaterials
      .filter(
        (material) =>
          (material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            material.projects.some((project) =>
              project.toLowerCase().includes(searchTerm.toLowerCase())
            )) &&
          (selectedProjects.length === 0 ||
            material.projects.some((project) =>
              selectedProjects.includes(project)
            ))
      )
      .sort((a, b) => {
        if (sortColumn === "name") {
          return sortDirection === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else {
          return sortDirection === "asc"
            ? a.projects.length - b.projects.length
            : b.projects.length - a.projects.length;
        }
      });
  }, [searchTerm, sortColumn, sortDirection, selectedProjects]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMaterials.slice(
      startIndex,
      startIndex + itemsPerPage
    );
  }, [filteredAndSortedMaterials, currentPage, itemsPerPage]);

  const parentRef = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      rowVirtualizer.scrollToIndex(0);
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: paginatedMaterials.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectedMaterials(checked ? paginatedMaterials.map((m) => m.id) : []);
  };

  const handleSelect = (materialId: number) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleMatch = () => {
    if (value) {
      const newMatches = { ...matchedMaterials };
      selectedMaterials.forEach((materialId) => {
        newMatches[materialId] = value;
      });
      setMatchedMaterials(newMatches);
      setValue("");
      setOpen(false);
      setSelectedMaterials([]);
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
    projectMaterials.forEach((material) =>
      material.projects.forEach((project) => projectSet.add(project))
    );
    return Array.from(projectSet).sort();
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
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
            placeholder="Search materials or projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filter Projects
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {allProjects.map((project) => (
                <DropdownMenuCheckboxItem
                  key={project}
                  checked={selectedProjects.includes(project)}
                  onCheckedChange={(checked) => {
                    setSelectedProjects((prev) =>
                      checked
                        ? [...prev, project]
                        : prev.filter((p) => p !== project)
                    );
                  }}
                >
                  {project}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                <TableHead
                  className="cursor-pointer"
                  onClick={() => toggleSort("projects")}
                >
                  Projects
                  <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead>KBOB Match</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          <ScrollArea className="h-[400px]" ref={parentRef}>
            <Table>
              <TableBody>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const material = paginatedMaterials[virtualRow.index];
                  return (
                    <TableRow
                      key={material.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedMaterials.includes(material.id)}
                          onCheckedChange={() => handleSelect(material.id)}
                          aria-label={`Select ${material.name}`}
                        />
                      </TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {material.projects.map((project) => (
                            <Badge
                              key={project}
                              variant="secondary"
                              className="text-xs"
                            >
                              {project}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {matchedMaterials[material.id] ? (
                          <Badge variant="outline">
                            {matchedMaterials[material.id]}
                          </Badge>
                        ) : (
                          "Not matched"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
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
        <div className="flex items-center space-x-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[300px] justify-between"
                disabled={selectedMaterials.length === 0}
              >
                {value
                  ? kbobMaterials.find((material) => material.name === value)
                      ?.name
                  : "Select KBOB material..."}
                <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search KBOB material..." />
                <CommandEmpty>No material found.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[200px]">
                    {kbobMaterials.map((material) => (
                      <CommandItem
                        key={material.id}
                        onSelect={() => {
                          setValue(material.name);
                          setOpen(false);
                        }}
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === material.name
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span>{material.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {material.category}
                        </Badge>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleMatch}
            disabled={!value || selectedMaterials.length === 0}
          >
            Match Selected
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
