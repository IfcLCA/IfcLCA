"use client";

import { ColumnDef } from "@tanstack/react-table";

interface MaterialTableItem {
  id: string;
  ifcMaterial: string;
  kbobMaterial: string;
  category: string;
  volume: number;
}

export const materialsColumns: ColumnDef<MaterialTableItem>[] = [
  {
    accessorKey: "ifcMaterial",
    header: "Ifc Material",
    enableResizing: true,
    size: 200,
    minSize: 100,
    cell: ({ row }) => (
      <div className="truncate">
        {row.getValue("ifcMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "kbobMaterial",
    header: "KBOB Material",
    enableResizing: true,
    size: 200,
    minSize: 100,
    cell: ({ row }) => (
      <div className="truncate">
        {row.getValue("kbobMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Element",
    enableResizing: true,
    size: 200,
    minSize: 100,
    cell: ({ row }) => (
      <div className="truncate">
        {row.getValue("category") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "volume",
    enableResizing: true,
    size: 100,
    minSize: 80,
    header: () => (
      <div className="text-center">
        Volume (m³)
      </div>
    ),
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      return (
        <div className="text-center">
          {volume?.toFixed(2) || "N/A"}
        </div>
      );
    },
  },
];
