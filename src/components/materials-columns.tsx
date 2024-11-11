"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface MaterialTableItem {
  id: string;
  name: string;
  category?: string;
  volume?: number;
  kbobMatch?: {
    id: string;
    name: string;
    indicators: {
      gwp: number;
      ubp: number;
      penre: number;
    };
  };
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
    id: "kbobMatch",
    header: "KBOB Match",
    cell: ({ row, table }) => {
      const kbobMaterials = (table.options.meta?.kbobMaterials || []) as any[];
      const onMatchKBOB = table.options.meta?.onMatchKBOB as Function;
      const kbobMatch = row.original.kbobMatch;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-[200px] justify-between"
            >
              <span className="truncate">
                {kbobMatch ? kbobMatch.name : "Select KBOB Material"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            {kbobMaterials.length > 0 ? (
              kbobMaterials.map((material) => (
                <DropdownMenuItem
                  key={material.id}
                  onClick={() => onMatchKBOB?.(row.original.id, material.id)}
                >
                  {material.name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                No KBOB materials available
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
