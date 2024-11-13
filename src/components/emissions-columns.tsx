import { ColumnDef } from "@tanstack/react-table";

const formatNumber = (value: number) => {
  const decimalPlaces = value > 100 ? 0 : 2;
  return (
    value?.toLocaleString("de-CH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }) ?? "N/A"
  );
};

export const emissionsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: "Element",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => formatNumber(row.original.volume),
  },
  {
    accessorKey: "indicators.gwp",
    header: "GWP (kg CO₂-eq)",
    cell: ({ row }) => formatNumber(row.original.indicators?.gwp),
  },
  {
    accessorKey: "indicators.ubp",
    header: "UBP",
    cell: ({ row }) => formatNumber(row.original.indicators?.ubp),
  },
  {
    accessorKey: "indicators.penre",
    header: "PENRE (kWh)",
    cell: ({ row }) => formatNumber(row.original.indicators?.penre),
  },
];
