"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import { useRouter } from "next/navigation";

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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const router = useRouter();

  // Move fetchElements outside useEffect
  async function fetchElements() {
    try {
      setIsLoading(true);
      console.log("Fetching elements for project:", params.id);
      const response = await fetch(`/api/projects/${params.id}/elements`);
      const data = await response.json();
      console.log("Fetched elements:", data);
      setElements(data);
    } catch (error) {
      console.error("Failed to fetch elements:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchElements();
  }, [params.id]);

  const handleUploadComplete = async () => {
    console.log("Upload complete, refreshing elements...");
    router.refresh(); // Refresh the current route
    await fetchElements();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Building Elements</h1>
        <Button onClick={() => setIsUploadModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Upload IFC
        </Button>
      </div>
      <DataTable columns={columns} data={elements} isLoading={isLoading} />

      <UploadModal
        projectId={params.id}
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
