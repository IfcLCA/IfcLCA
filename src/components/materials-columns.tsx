"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MaterialDocument } from "@/types/mongodb";

export interface MaterialTableItem {
  id: string;
  name: string;
  category: string;
  volume: number;
  count: number;
}

export const materialsColumns: ColumnDef<MaterialTableItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "count",
    header: "Occurrences",
    cell: ({ row }) => {
      const count = row.getValue("count");
      return count || 0;
    },
  },
];
