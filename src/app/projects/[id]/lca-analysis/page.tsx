import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

export default function LCAAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  // In a real application, you would fetch this data from an API based on the project ID
  const lcaResults = [
    {
      id: 1,
      category: "Global Warming Potential",
      value: 1000,
      unit: "kg CO2 eq",
    },
    {
      id: 2,
      category: "Ozone Depletion Potential",
      value: 0.1,
      unit: "kg CFC-11 eq",
    },
    { id: 3, category: "Acidification Potential", value: 5, unit: "kg SO2 eq" },
    {
      id: 4,
      category: "Eutrophication Potential",
      value: 0.5,
      unit: "kg PO4 eq",
    },
    {
      id: 5,
      category: "Photochemical Ozone Creation Potential",
      value: 2,
      unit: "kg C2H4 eq",
    },
  ];

  const columns = [
    {
      accessorKey: "category",
      header: "Impact Category",
    },
    {
      accessorKey: "value",
      header: "Value",
    },
    {
      accessorKey: "unit",
      header: "Unit",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">LCA Analysis Results</h1>
        <Button>
          <FileDown className="mr-2 h-4 w-4" />
          Export Results
        </Button>
      </div>
      <DataTable columns={columns} data={lcaResults} />
      <div className="bg-muted p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Analysis Summary</h2>
        <p>
          This Life Cycle Assessment (LCA) analysis provides an overview of the
          environmental impacts associated with the building project. The
          results are calculated based on the materials and quantities derived
          from the Ifc model, combined with environmental impact data from our
          materials library.
        </p>
      </div>
    </div>
  );
}
