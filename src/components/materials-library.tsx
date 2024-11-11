"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "./data-table";
import { materialsColumns } from "./materials-columns";

interface KBOBMaterial {
  id: string;
  name: string;
  kbobId: number;
  indicators: {
    gwp: number;
    ubp: number;
    penre: number;
  };
}

interface ProjectMaterial {
  id: string;
  name: string;
  category?: string;
  volume?: number;
  kbobMatch?: {
    id: string;
    name: string;
    indicators: {
      gwp: number;
      ubp: number;
      penre: number;
    };
  };
}

export function MaterialLibraryComponent() {
  const [projectMaterials, setProjectMaterials] = useState<ProjectMaterial[]>(
    []
  );
  const [kbobMaterials, setKbobMaterials] = useState<KBOBMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [materialsRes, kbobRes] = await Promise.all([
          fetch("/api/materials"),
          fetch("/api/kbob"),
        ]);

        if (!materialsRes.ok || !kbobRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const materials = await materialsRes.json();
        const kbob = await kbobRes.json();

        console.log("KBOB Materials:", kbob); // Debug log
        setProjectMaterials(materials);
        setKbobMaterials(kbob);
      } catch (error) {
        console.error("Failed to fetch materials:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleMatchKBOB = async (materialId: string, kbobId: string) => {
    try {
      const response = await fetch(`/api/materials/${materialId}/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kbobId }),
      });

      if (!response.ok) throw new Error("Failed to match material");

      const updatedMaterial = await response.json();
      setProjectMaterials((prev) =>
        prev.map((material) =>
          material.id === materialId ? updatedMaterial : material
        )
      );
    } catch (error) {
      console.error("Failed to match material:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Material Library</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={materialsColumns}
          data={projectMaterials}
          isLoading={isLoading}
          kbobMaterials={kbobMaterials}
          onMatchKBOB={handleMatchKBOB}
        />
      </CardContent>
    </Card>
  );
}
