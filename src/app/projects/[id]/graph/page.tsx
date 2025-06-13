import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GraphPageComponent } from "@/components/graph-page";
import { GraphSkeleton } from "@/components/skeletons";

async function MaterialsGraph({ projectId }: { projectId: string }) {
  const res = await fetch(`/api/projects/${projectId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch project data");
  }

  const project = await res.json();

  // Transform the data
  const materialsData = project.elements.flatMap((element: any) =>
    element.materials.map((materialEntry: any) => {
      // Find the material details from the materials array
      const materialDetails = project.materials.find(
        (m: any) => m.id === materialEntry.material
      );

      return {
        name: materialDetails?.name || "Unknown",
        volume: materialEntry.volume || 0,
        indicators: materialEntry.indicators || {
          gwp: 0,
          ubp: 0,
          penre: 0,
        },
      };
    })
  );

  return (
    <div className="container mx-auto p-4">
      <div className="print:hidden">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>{project.description}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <GraphPageComponent materialsData={materialsData} />
    </div>
  );
}

export default function GraphPage({ params }: { params: { id: string } }) {
  return (
    <div className="main-container">
      <div className="page-header">
        <h2 className="page-title">Material Emissions Graph</h2>
      </div>
      <Suspense fallback={<GraphSkeleton />}>
        <MaterialsGraph projectId={params.id} />
      </Suspense>
    </div>
  );
}
