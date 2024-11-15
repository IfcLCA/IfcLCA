"use client";

import { ColumnDef } from "@tanstack/react-table";

interface EmissionRow {
  id: string;
  kbobMaterial: string;
  ifcMaterial: string;
  volume: number;
  density: number;
  indicators: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  kbobIndicators: {
    gwp: number;
    ubp: number;
    penre: number;
  };
}

const formatNumber = (value: number, decimalPlaces: number = 2) => {
  return (
    value?.toLocaleString("de-CH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }) ?? "N/A"
  );
};

type IndicatorType = "gwp" | "ubp" | "penre";

const indicatorLabels = {
  gwp: {
    name: "GWP",
    unit: "kg CO₂ eq",
    kbobUnit: "kg CO₂ eq/kg",
    decimals: 3,
  },
  ubp: {
    name: "UBP",
    unit: "UBP",
    kbobUnit: "UBP/kg",
    decimals: 0,
  },
  penre: {
    name: "PENRE",
    unit: "MJ",
    kbobUnit: "MJ/kg",
    decimals: 3,
  },
};

export const emissionsColumns = (selectedIndicator: IndicatorType): ColumnDef<EmissionRow>[] => [
  {
    accessorKey: "kbobMaterial",
    header: "KBOB Material",
    enableResizing: true,
    size: 250,
    minSize: 150,
    cell: ({ row }) => (
      <div className="truncate">
        {row.getValue("kbobMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "ifcMaterial",
    header: "IFC Material",
    enableResizing: true,
    size: 250,
    minSize: 150,
    cell: ({ row }) => (
      <div className="truncate">
        {row.getValue("ifcMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "volume",
    enableResizing: true,
    size: 130,
    minSize: 100,
    header: () => (
      <div className="text-center">
        Volume (m³)
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {formatNumber(row.getValue("volume"), 2)}
      </div>
    ),
  },
  {
    accessorKey: "density",
    enableResizing: true,
    size: 130,
    minSize: 100,
    header: () => (
      <div className="text-center">
        Density (kg/m³)
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {formatNumber(row.getValue("density"), 0)}
      </div>
    ),
  },
  {
    accessorKey: "kbobIndicators",
    id: "kbob_indicator",
    enableResizing: true,
    size: 200,
    minSize: 150,
    header: () => (
      <div className="text-center">
        KBOB {indicatorLabels[selectedIndicator].name} ({indicatorLabels[selectedIndicator].kbobUnit})
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {formatNumber(
          row.original.kbobIndicators[selectedIndicator],
          indicatorLabels[selectedIndicator].decimals
        )}
      </div>
    ),
  },
  {
    accessorKey: "indicators",
    id: "total_indicator",
    enableResizing: true,
    size: 200,
    minSize: 150,
    header: () => (
      <div className="text-center">
        Total {indicatorLabels[selectedIndicator].name} ({indicatorLabels[selectedIndicator].unit})
      </div>
    ),
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      const density = row.getValue("density") as number;
      const indicatorPerKg = row.original.kbobIndicators[selectedIndicator];
      const total = volume * density * indicatorPerKg;
      
      return (
        <div className="text-center">
          {formatNumber(total, 0)}
        </div>
      );
    },
  },
];
