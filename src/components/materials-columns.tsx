"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

interface Material {
  _id: string;
  name: string;
  material: {
    name: string;
    density: number;
    kbobMatch?: {
      Name: string;
      GWP: number;
      UBP: number;
      PENRE: number;
    };
  };
  volume: number;
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
}

export const materialsColumns: ColumnDef<Material>[] = [
  {
    accessorKey: "material.name",
    header: "IFC Material",
  },
  {
    accessorKey: "material.kbobMatch.Name",
    header: "KBOB Material",
    cell: ({ row }) => {
      const kbobName = row.original.material?.kbobMatch?.Name;
      return kbobName || <Badge variant="outline">No Match</Badge>;
    },
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.original.volume;
      return volume.toLocaleString("de-CH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    },
  },
  {
    accessorKey: "material.density",
    header: "Density (kg/m³)",
    cell: ({ row }) => {
      const density = row.original.material?.density;
      if (!density) return <Badge variant="outline">Not Set</Badge>;
      return density.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
  {
    accessorKey: "emissions.gwp",
    header: "GWP (kg CO₂ eq)",
    cell: ({ row }) => {
      const gwp = row.original.emissions?.gwp || 0;
      return gwp.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
  {
    accessorKey: "emissions.ubp",
    header: "UBP",
    cell: ({ row }) => {
      const ubp = row.original.emissions?.ubp || 0;
      return ubp.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
  {
    accessorKey: "emissions.penre",
    header: "PENRE (kWh oil-eq)",
    cell: ({ row }) => {
      const penre = row.original.emissions?.penre || 0;
      return penre.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
];
