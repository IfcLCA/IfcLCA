"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface MappingEntry {
  materialName: string;
  density?: number;
  kbob: { id: string; Name: string };
}

interface MaterialMappingsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function MaterialMappingsModal({ open, onOpenChange }: MaterialMappingsModalProps) {
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [kbobMaterials, setKbobMaterials] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/materials/mappings").then((r) => r.json()).then(setMappings);
    fetch("/api/kbob").then((r) => r.json()).then(setKbobMaterials);
  }, [open]);

  const handleUpdate = async (name: string, kbobId: string) => {
    await fetch("/api/materials/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialName: name, kbobMaterialId: kbobId }),
    });
    setMappings((m) => m.map((e) => (e.materialName === name ? { ...e, kbob: { ...e.kbob, id: kbobId } } : e)));
  };

  const handleDelete = async (name: string) => {
    await fetch("/api/materials/mappings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialName: name }),
    });
    setMappings((m) => m.filter((e) => e.materialName !== name));
  };

  const handleExport = async () => {
    const res = await fetch("/api/materials/mappings/export");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "material-mappings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      await fetch("/api/materials/mappings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      // Refresh mappings from the server to include populated KBOB details
      const res = await fetch("/api/materials/mappings");
      const updated = await res.json();
      setMappings(updated as MappingEntry[]);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Saved Material Mappings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {mappings.map((m) => (
            <div key={m.materialName} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">{m.materialName}</p>
              </div>
              <Select value={m.kbob.id} onValueChange={(v) => handleUpdate(m.materialName, v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kbobMaterials.map((k) => (
                    <SelectItem key={k._id} value={k._id}>{k.Name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => handleDelete(m.materialName)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter className="flex justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>Export</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Import</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
