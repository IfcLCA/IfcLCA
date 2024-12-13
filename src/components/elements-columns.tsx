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
    header: ({ column }) => <div className="flex items-center">Name</div>,
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
    header: ({ column }) => <div className="flex items-center">Properties</div>,
    accessorFn: (row) => {
      // Create a string that can be sorted based on the properties
      // Format: "1_1" for both true, "1_0" for loadBearing only, "0_1" for external only, "0_0" for none
      return `${row.loadBearing ? "1" : "0"}_${row.isExternal ? "1" : "0"}`;
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        {row.original.loadBearing && (
          <Badge
            variant="secondary"
            className="bg-blue-500/10 text-blue-500 border-blue-500/20"
          >
            Load Bearing
          </Badge>
        )}
        {row.original.isExternal && (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-500 border-green-500/20"
          >
            External
          </Badge>
        )}
      </div>
    ),
    sortingFn: (rowA, rowB, columnId) => {
      // Custom sorting function to handle the string format we created
      const valueA = rowA.getValue(columnId) as string;
      const valueB = rowB.getValue(columnId) as string;
      return valueA.localeCompare(valueB);
    },
  },
];
