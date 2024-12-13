"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

interface EmissionRow {
  _id: string;
  name: string;
  type: string;
  totalVolume: number;
  emissions: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  materials: Array<{
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
  }>;
}

export const emissionsColumns = (
  indicator: "gwp" | "ubp" | "penre"
): ColumnDef<EmissionRow>[] => [
  {
    accessorKey: "name",
    header: "Element",
  },
  {
    accessorKey: "totalVolume",
    header: "Volume (m³)",
    cell: ({ row }) => {
      const volume = row.original.totalVolume;
      return volume.toLocaleString("de-CH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    },
  },
  {
    accessorKey: "materials",
    header: "Materials",
    cell: ({ row }) => (
      <div className="space-y-1">
        {row.original.materials.map((mat, idx) => {
          // Calculate emission for this material
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const kbobValue =
            mat.material?.kbobMatch?.[
              indicator === "gwp"
                ? "GWP"
                : indicator === "ubp"
                ? "UBP"
                : "PENRE"
            ] || 0;
          const emission = volume * density * kbobValue;

          return (
            <div key={idx} className="text-sm">
              <span className="font-medium">
                {mat.material?.kbobMatch?.Name ||
                  mat.material?.name ||
                  "Unknown"}
              </span>
              <span className="text-muted-foreground ml-2">
                (
                {emission.toLocaleString("de-CH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                {indicator === "gwp"
                  ? "kg CO₂ eq"
                  : indicator === "ubp"
                  ? "UBP"
                  : "kWh oil-eq"}
                )
              </span>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    accessorKey: `emissions.${indicator}`,
    header: () => {
      const label = {
        gwp: "GWP (kg CO₂ eq)",
        ubp: "UBP",
        penre: "PENRE (kWh oil-eq)",
      }[indicator];
      return label;
    },
    cell: ({ row }) => {
      const value = row.original.emissions[indicator];
      return value.toLocaleString("de-CH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  },
];
