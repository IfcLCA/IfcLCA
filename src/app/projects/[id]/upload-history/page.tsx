"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UploadHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([
    {
      id: 1,
      fileName: "model_v1.ifc",
      uploadDate: "2023-05-01",
      fileSize: "10.5 MB",
      status: "Processed",
    },
    {
      id: 2,
      fileName: "model_v2.ifc",
      uploadDate: "2023-05-15",
      fileSize: "11.2 MB",
      status: "Processing",
    },
    {
      id: 3,
      fileName: "model_v3.ifc",
      uploadDate: "2023-06-01",
      fileSize: "12.0 MB",
      status: "Failed",
    },
  ]);

  const columns = [
    {
      accessorKey: "fileName",
      header: "File Name",
    },
    {
      accessorKey: "uploadDate",
      header: "Upload Date",
    },
    {
      accessorKey: "fileSize",
      header: "File Size",
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <FileDown className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Implement file upload logic here
    setIsUploadDialogOpen(false);
  };

  const handleDelete = (id: number) => {
    setUploadHistory(uploadHistory.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Upload History</h1>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload New File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New IFC File</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label htmlFor="file">Select File</Label>
                <Input id="file" type="file" accept=".ifc" required />
              </div>
              <Button type="submit">Upload</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={uploadHistory} />
      <div className="bg-muted p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Upload Information</h2>
        <p>
          This page displays the history of IFC file uploads for the current
          project. You can upload new files, download existing ones, or remove
          files from the project. The status column shows whether the file has
          been successfully processed for LCA analysis.
        </p>
      </div>
    </div>
  );
}
