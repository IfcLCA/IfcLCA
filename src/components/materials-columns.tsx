"use client";

import { ColumnDef } from "@tanstack/react-table";

interface MaterialTableItem {
  id: string;
  name: string;
  category?: string;
  volume?: number;
  projects?: string[];
}

export const materialsColumns: ColumnDef<MaterialTableItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "category",
    header: "Category",
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      return volume?.toFixed(2) || "N/A";
    },
  },
  {
    accessorKey: "projects",
    header: "Projects",
    cell: ({ row }) => {
      const projects = row.getValue("projects") as string[];
      return projects?.length || 0;
    },
  },
];
