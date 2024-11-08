"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UploadModal } from "@/components/upload-modal";

const columns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "volume",
    header: "Volume",
    cell: ({ row }: { row: { original: { volume: number } } }) =>
      row.original.volume?.toFixed(2) ?? "N/A",
  },
  {
    accessorKey: "buildingStorey",
    header: "Level",
  },
];

export default function BuildingElementsPage({
  params,
}: {
  params: { id: string };
}) {
  const [elements, setElements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchElements() {
      try {
        const response = await fetch(`/api/projects/${params.id}/elements`);
        const data = await response.json();
        setElements(data);
      } catch (error) {
        console.error("Failed to fetch elements:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchElements();
  }, [params.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Building Elements</h1>
        <UploadModal projectId={params.id} />
      </div>
      <DataTable columns={columns} data={elements} isLoading={isLoading} />
    </div>
  );
}
