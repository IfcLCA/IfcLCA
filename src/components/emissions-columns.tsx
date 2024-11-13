import { ColumnDef } from "@tanstack/react-table";

export const emissionsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: "Element",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "volume",
    header: "Volume (m³)",
    cell: ({ row }) => row.original.volume?.toFixed(2) ?? "N/A",
  },
  {
    accessorKey: "indicators.gwp",
    header: "GWP (kg CO₂-eq)",
    cell: ({ row }) => row.original.indicators?.gwp?.toFixed(2) ?? "N/A",
  },
  {
    accessorKey: "indicators.ubp",
    header: "UBP",
    cell: ({ row }) => row.original.indicators?.ubp?.toFixed(2) ?? "N/A",
  },
  {
    accessorKey: "indicators.penre",
    header: "PENRE (kWh)",
    cell: ({ row }) => row.original.indicators?.penre?.toFixed(2) ?? "N/A",
  },
];
