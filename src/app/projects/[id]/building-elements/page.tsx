import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { UploadModal } from "@/components/upload-modal";

// Define the columns configuration
const columns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "volume",
    header: "Volume",
    cell: ({ row }) => row.original.volume.toFixed(2),
  },
  {
    accessorKey: "buildingStorey",
    header: "Level",
  },
];

async function getBuildingElements(projectId: string) {
  try {
    const elements = await prisma.element.findMany({
      where: { projectId },
      include: { materials: true },
    });

    return elements.map((element) => ({
      id: element.id,
      name: element.name,
      type: element.type,
      material: element.materials[0]?.name || "Unknown",
      volume: element.volume,
      buildingStorey: element.buildingStorey,
    }));
  } catch (error) {
    console.error("Failed to fetch building elements:", error);
    return [];
  }
}

export default async function BuildingElementsPage({
  params,
}: {
  params: { id: string };
}) {
  const elements = await getBuildingElements(params.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Building Elements</h1>
        <UploadModal
          projectId={params.id}
          onUploadComplete={() => {
            // Use server actions or client-side refresh logic
          }}
        />
      </div>
      <DataTable columns={columns} data={elements} />
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
