import { ColumnDef } from "@tanstack/react-table";

interface EmissionRow {
  name: string;
  volume: number;
  kbobMaterial: string;
  ifcMaterial: string;
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

export const emissionsColumns: ColumnDef<EmissionRow>[] = [
  {
    accessorKey: "kbobMaterial",
    header: "KBOB Material",
    cell: ({ row }) => row.getValue("kbobMaterial") || "Unknown",
  },
  {
    accessorFn: (row) => row.kbobIndicators.gwp,
    id: "kbob_gwp",
    header: "KBOB GWP (kg CO₂ eq/kg)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("kbob_gwp"), 2)}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.kbobIndicators.ubp,
    id: "kbob_ubp",
    header: "KBOB UBP (UBP/kg)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("kbob_ubp"), 2)}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.kbobIndicators.penre,
    id: "kbob_penre",
    header: "KBOB PENRE (MJ/kg)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("kbob_penre"), 2)}
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: "Element Name",
    cell: ({ row }) => row.getValue("name"),
  },
  {
    accessorKey: "ifcMaterial",
    header: "IFC Material",
    cell: ({ row }) => row.getValue("ifcMaterial") || "Unknown",
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("volume"), 2)}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.indicators.gwp,
    id: "gwp",
    header: "Total GWP (kg CO₂ eq)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("gwp"), 2)}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.indicators.ubp,
    id: "ubp",
    header: "Total UBP",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("ubp"), 2)}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.indicators.penre,
    id: "penre",
    header: "Total PENRE (MJ)",
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("penre"), 2)}
      </div>
    ),
  },
];
