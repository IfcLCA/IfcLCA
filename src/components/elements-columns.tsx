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
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "totalVolume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.original.totalVolume;
      return volume?.toLocaleString("de-CH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    },
  },
  {
    accessorKey: "materials",
    header: "Materials",
    cell: ({ row }) => {
      const materials = row.original.materials;
      return (
        <div className="space-y-1">
          {materials.map((mat, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-medium">
                {mat.material?.kbobMatch?.Name ||
                  mat.material?.name ||
                  "Unknown"}
              </span>
              <span className="text-muted-foreground ml-2">
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
    accessorKey: "emissions",
    header: "GWP (kg CO₂ eq)",
    cell: ({ row }) => {
      const gwp = row.original.emissions?.gwp || 0;
      return gwp.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
  {
    id: "properties",
    header: "Properties",
    cell: ({ row }) => (
      <div className="space-x-2">
        {row.original.loadBearing && (
          <Badge variant="secondary">Load Bearing</Badge>
        )}
        {row.original.isExternal && <Badge variant="secondary">External</Badge>}
      </div>
    ),
  },
];
