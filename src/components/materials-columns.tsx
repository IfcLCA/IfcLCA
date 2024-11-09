"use client";

import { ColumnDef } from "@tanstack/react-table";

export type Material = {
  id: string;
  name: string;
  count: number;
};

export const materialsColumns: ColumnDef<Material>[] = [
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
