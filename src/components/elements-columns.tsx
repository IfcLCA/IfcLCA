"use client";

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Element {
  _id: string;
  name: string;
  type: string;
  totalVolume: number;
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  materials: Array<{
    material: {
      name: string;
      kbobMatch?: {
        Name: string;
      };
    };
    volume: number;
  }>;
  isExternal: boolean;
  loadBearing: boolean;
}

export const elementsColumns: ColumnDef<Element>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="truncate max-w-[200px] lg:max-w-[300px] font-medium">
        {row.original.name}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Ifc Class",
    cell: ({ row }) => (
      <div className="truncate max-w-[150px] lg:max-w-[200px] text-muted-foreground">
        {row.original.type}
      </div>
    ),
  },
  {
    accessorKey: "totalVolume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.original.totalVolume;
      return (
        <div className="font-medium tabular-nums">
          {volume?.toLocaleString("de-CH", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "materials",
    header: "Materials",
    cell: ({ row }) => {
      const materials = row.original.materials;
      return (
        <div className="space-y-1 max-w-[250px] lg:max-w-[400px]">
          {materials.map((mat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="truncate font-medium">
                {mat.material?.kbobMatch?.Name ||
                  mat.material?.name ||
                  "Unknown"}
              </span>
              <span className="text-muted-foreground whitespace-nowrap">
                (
                {mat.volume.toLocaleString("de-CH", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}{" "}
                m³)
              </span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "properties",
    header: "Properties",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        {row.original.loadBearing && (
          <Badge variant="secondary">Load Bearing</Badge>
        )}
        {row.original.isExternal && <Badge variant="secondary">External</Badge>}
      </div>
    ),
  },
];
