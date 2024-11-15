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
    cell: ({ row }) => (
      <div className="w-[200px] truncate">
        {row.getValue("kbobMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "ifcMaterial",
    header: "IFC Material",
    cell: ({ row }) => (
      <div className="w-[200px] truncate">
        {row.getValue("ifcMaterial") || "Unknown"}
      </div>
    ),
  },
  {
    accessorKey: "volume",
    header: () => (
      <div className="text-center w-[100px]">
        Volume (m³)
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center w-[100px]">
        {formatNumber(row.getValue("volume"), 2)}
      </div>
    ),
  },
  {
    accessorKey: "density",
    header: () => (
      <div className="text-center w-[100px]">
        Density (kg/m³)
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center w-[100px]">
        {formatNumber(row.getValue("density"), 0)}
      </div>
    ),
  },
  {
    accessorKey: "kbobIndicators",
    id: "kbob_indicator",
    header: () => (
      <div className="text-center w-[120px]">
        KBOB {indicatorLabels[selectedIndicator].name} ({indicatorLabels[selectedIndicator].kbobUnit})
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center w-[120px]">
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
    header: () => (
      <div className="text-center w-[120px]">
        Total {indicatorLabels[selectedIndicator].name} ({indicatorLabels[selectedIndicator].unit})
      </div>
    ),
    cell: ({ row }) => {
      const volume = row.getValue("volume") as number;
      const density = row.getValue("density") as number;
      const indicatorPerKg = row.original.kbobIndicators[selectedIndicator];
      const total = volume * density * indicatorPerKg;
      
      return (
        <div className="text-center w-[120px]">
          {formatNumber(total, 0)}
        </div>
      );
    },
  },
];
