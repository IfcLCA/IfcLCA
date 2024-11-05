import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PrismaClient } from "@prisma/client";
import { UploadModal } from "@/components/upload-modal";

async function getBuildingElements(projectId: string) {
  const prisma = new PrismaClient();

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
          onSuccess={() => {
            // Refresh the page to show new elements
            window.location.reload();
          }}
          onProgress={(progress) => {
            console.log("Upload progress:", progress);
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
