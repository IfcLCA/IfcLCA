import { DataTable } from "@/components/data-table";
import { emissionsColumns } from "@/components/emissions-columns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function EmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const { id } = await params;
  // Fetch project data
  const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
  const project = await res.json();

  return (
    <div className="main-container">
      <div className="page-header">
        <h2 className="page-title">
          Emissions{" "}
          <Badge variant="secondary" className="ml-2">
            {project?.elements?.length || 0}
          </Badge>
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={emissionsColumns as any}
            data={project.elements.flatMap(
              (element: {
                materials: Array<{
                  material?: { name: string };
                  volume: number;
                  indicators: any;
                }>;
              }) =>
                element.materials.map((material) => ({
                  name: material.material?.name || "Unknown",
                  volume: material.volume,
                  indicators: material.indicators,
                }))
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
