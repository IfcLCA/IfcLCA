"use client";

import { ColumnDef } from "@tanstack/react-table";

export type Material = {
  id: string;
  name: string;
  volume: number | null;
  fraction: number | null;
};

export const materialsColumns: ColumnDef<Material>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.getValue("volume");
      return volume ? `${parseFloat(volume as string).toFixed(2)}` : "-";
    },
  },
  {
    accessorKey: "fraction",
    header: "Fraction (%)",
    cell: ({ row }) => {
      const fraction = row.getValue("fraction");
      return fraction
        ? `${(parseFloat(fraction as string) * 100).toFixed(1)}%`
        : "-";
    },
  },
];
