"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { elementsColumns } from "@/components/elements-columns";
import { materialsColumns } from "@/components/materials-columns";
import { emissionsColumns } from "@/components/emissions-columns";

interface Props {
  projectId: string;
  uploadIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComparisonModal({
  projectId,
  uploadIds,
  open,
  onOpenChange,
}: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`/api/projects/${projectId}/comparison`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds }),
      })
        .then((res) => res.json())
        .then(setData)
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [open, projectId, uploadIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Comparison</DialogTitle>
        </DialogHeader>
        {loading && <div className="p-6">Loading...</div>}
        {!loading && data && (
          <Tabs defaultValue="elements" className="mt-4">
            <TabsList>
              <TabsTrigger value="elements">Elements</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="emissions">Emissions</TabsTrigger>
            </TabsList>
            <TabsContent value="elements" className="space-y-8 mt-4">
              {data.uploads.map((u: any) => (
                <div key={u.uploadId} className="space-y-2">
                  <h3 className="font-semibold">{u.filename}</h3>
                  <DataTable columns={elementsColumns} data={u.elements} />
                </div>
              ))}
            </TabsContent>
            <TabsContent value="materials" className="space-y-8 mt-4">
              {data.uploads.map((u: any) => (
                <div key={u.uploadId} className="space-y-2">
                  <h3 className="font-semibold">{u.filename}</h3>
                  <DataTable
                    columns={materialsColumns as any}
                    data={u.materials}
                  />
                </div>
              ))}
            </TabsContent>
            <TabsContent value="emissions" className="space-y-8 mt-4">
              {data.uploads.map((u: any) => (
                <div key={u.uploadId} className="space-y-2">
                  <h3 className="font-semibold">{u.filename}</h3>
                  <DataTable
                    columns={emissionsColumns("gwp")}
                    data={u.elements}
                  />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
