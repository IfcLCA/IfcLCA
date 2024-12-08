"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  LayoutDashboard,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ElementTableItem {
  id: string;
  name: string;
  type: string;
  volume: number;
  loadBearing: boolean;
  isExternal: boolean;
}

export const elementsColumns: ColumnDef<ElementTableItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="truncate max-w-[300px]" title={row.getValue("name")}>
        {row.getValue("name")}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          IFC Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="truncate">{row.getValue("type")}</div>,
  },
  {
    accessorKey: "loadBearing",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Load Bearing
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const isLoadBearing = row.getValue("loadBearing");
      return (
        <div
          className="flex justify-center"
          title={isLoadBearing ? "Yes" : "No"}
        >
          {isLoadBearing ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-red-400" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "isExternal",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          External
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const isExternal = row.getValue("isExternal");
      return (
        <div
          className="flex justify-center"
          title={isExternal ? "External" : "Internal"}
        >
          {isExternal ? (
            <Check className="h-4 w-4 text-blue-600" />
          ) : (
            <X className="h-4 w-4 text-red-400" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "volume",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Volume (m³)
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      return (
        <div className="text-right">
          {volume?.toLocaleString("de-CH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || "N/A"}
        </div>
      );
    },
  },
];
