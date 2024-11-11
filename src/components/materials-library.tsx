"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationWithNumbers } from "@/components/ui/pagination-with-numbers";

type Material = {
  id: string;
  name: string;
  volume: number;
  category?: string;
};

const PAGE_SIZES = [10, 20, 50];

export function MaterialsLibrary({
  initialProjects,
  initialMaterials,
}: {
  initialProjects: any[];
  initialMaterials: Material[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const currentPage = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 10;

  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [projects] = useState(initialProjects);
  const [selectedProject, setSelectedProject] = useState<string>(
    projects[0]?.id
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  useEffect(() => {
    async function fetchMaterials() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/materials?projectId=${selectedProject}`
        );
        const data = await response.json();
        setMaterials(data);
      } catch (error) {
        console.error("Failed to fetch materials:", error);
      }
      setLoading(false);
    }

    fetchMaterials();
  }, [selectedProject]);

  useEffect(() => {
    console.log("Initial materials:", initialMaterials);
  }, [initialMaterials]);

  const filteredMaterials = materials.filter((material) =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMaterials.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMaterials = filteredMaterials.slice(
    startIndex,
    startIndex + pageSize
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Materials</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                <SelectItem value="all">All Projects</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                const params = new URLSearchParams(searchParams);
                params.set("pageSize", value);
                params.set("page", "1");
                replace(`${pathname}?${params.toString()}`);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Volume (m³)</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    No materials found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>{material.name}</TableCell>
                    <TableCell>{material.volume.toFixed(2)}</TableCell>
                    <TableCell>{material.category || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationWithNumbers
            totalPages={totalPages}
            showingText={`Showing ${startIndex + 1}-${Math.min(
              startIndex + pageSize,
              filteredMaterials.length
            )} of ${filteredMaterials.length}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
