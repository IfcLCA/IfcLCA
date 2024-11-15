"use client";

import { ColumnDef } from "@tanstack/react-table";

interface ElementTableItem {
  id: string;
  name: string;
  type: string;
  volume: number;
}

export const elementsColumns: ColumnDef<ElementTableItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "volume",
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
