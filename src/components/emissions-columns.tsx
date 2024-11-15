"use client";

import { ColumnDef } from "@tanstack/react-table";

interface EmissionRow {
  id: string;
  kbobMaterial: string;
  ifcMaterial: string;
  volume: number;
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
    cell: ({ row }) => row.getValue("kbobMaterial") || "Unknown",
  },
  {
    accessorKey: "kbobIndicators",
    id: "kbob_indicator",
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
    accessorKey: "ifcMaterial",
    header: "IFC Material",
    cell: ({ row }) => row.getValue("ifcMaterial") || "Unknown",
  },
  {
    accessorKey: "volume",
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
    accessorKey: "indicators",
    id: "total_indicator",
    header: () => (
      <div className="text-center">
        Total {indicatorLabels[selectedIndicator].name} ({indicatorLabels[selectedIndicator].unit})
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {formatNumber(row.original.indicators[selectedIndicator], 0)}
      </div>
    ),
  },
];
