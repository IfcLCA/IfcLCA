import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function BuildingElementsPage({
  params,
}: {
  params: { id: string };
}) {
  // In a real application, you would fetch this data from an API based on the project ID
  const buildingElements = [
    {
      id: 1,
      name: "External Wall",
      type: "IfcWall",
      material: "Concrete",
      volume: 100,
      unit: "m³",
    },
    {
      id: 2,
      name: "Internal Wall",
      type: "IfcWall",
      material: "Gypsum Board",
      volume: 50,
      unit: "m³",
    },
    {
      id: 3,
      name: "Floor Slab",
      type: "IfcSlab",
      material: "Reinforced Concrete",
      volume: 200,
      unit: "m³",
    },
    {
      id: 4,
      name: "Roof",
      type: "IfcRoof",
      material: "Steel",
      volume: 75,
      unit: "m³",
    },
    {
      id: 5,
      name: "Window",
      type: "IfcWindow",
      material: "Glass",
      volume: 10,
      unit: "m³",
    },
  ];

  const columns = [
    {
      accessorKey: "name",
      header: "Element Name",
    },
    {
      accessorKey: "type",
      header: "IFC Type",
    },
    {
      accessorKey: "material",
      header: "Material",
    },
    {
      accessorKey: "volume",
      header: "Volume",
    },
    {
      accessorKey: "unit",
      header: "Unit",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Building Elements</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Element
        </Button>
      </div>
      <DataTable columns={columns} data={buildingElements} />
      <div className="bg-muted p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Element Information</h2>
        <p>
          This table displays all building elements extracted from the IFC
          model. Each element is associated with its material and volume, which
          are used in the LCA calculations. You can add custom elements or
          modify existing ones to refine your analysis.
        </p>
      </div>
    </div>
  );
}
