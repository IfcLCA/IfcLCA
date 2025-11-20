"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { FileDown, Trash2 } from "lucide-react";
import { UploadModal } from "@/components/upload-modal";

const columns = [
  {
    accessorKey: "filename",
    header: "Filename",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "createdAt",
    header: "Upload Date",
    cell: ({ row }: { row: { original: { createdAt: string } } }) =>
      new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: ({ row }: { row: any }) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">
          <FileDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

export function UploadHistoryClient({ projectId }: { projectId: string }) {
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/uploads`);
      const data = await response.json();
      setUploadHistory(data);
    } catch (error) {
      console.error("Failed to fetch upload history:", error);
    }
  }, [projectId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleUploadSuccess = () => {
    setIsRefreshing(true);
    refreshData().finally(() => setIsRefreshing(false));
    setIsUploadModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Upload History</h1>
        <Button onClick={() => setIsUploadModalOpen(true)}>Upload IFC</Button>
        <UploadModal
          projectId={projectId}
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          onSuccess={handleUploadSuccess}
        />
      </div>
      <DataTable columns={columns} data={uploadHistory} />
    </div>
  );
}
