"use client";

import { ColumnDef } from "@tanstack/react-table";

export interface MaterialTableItem {
  id: string;
  name: string;
  category: string;
  volume: number;
}

export const materialsColumns: ColumnDef<MaterialTableItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.getValue("category");
      return category || "N/A";
    },
  },
  {
    accessorKey: "volume",
    header: "Volume",
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      return volume ? `${volume.toFixed(2)} m³` : "0 m³";
    },
  },
];
