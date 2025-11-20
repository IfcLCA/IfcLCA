import { DataTable } from "@/components/data-table";
import { emissionsColumns, type EmissionRow } from "@/components/emissions-columns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";

export default async function EmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ query?: string; page?: string; indicator?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  // Get indicator from searchParams, default to "gwp"
  const indicator = (resolvedSearchParams?.indicator === "ubp" ||
    resolvedSearchParams?.indicator === "penre")
    ? resolvedSearchParams.indicator
    : "gwp";

  // Fetch project data
  const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
  const project = await res.json();

  // Transform elements to EmissionRow format
  const emissionRows: EmissionRow[] = (project.elements || []).map(
    (element: {
      _id: string;
      name: string;
      type?: string;
      totalVolume?: number;
      materials: Array<{
        material?: {
          name: string;
          density?: number;
          kbobMatch?: any;
        };
        volume: number;
      }>;
    }) => {
      // Calculate emissions from materials
      const emissions = element.materials.reduce(
        (acc, mat) => {
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const mass = volume * density;
          const kbobMatch = mat.material?.kbobMatch;

          return {
            gwp: acc.gwp + mass * getGWP(kbobMatch),
            ubp: acc.ubp + mass * getUBP(kbobMatch),
            penre: acc.penre + mass * getPENRE(kbobMatch),
          };
        },
        { gwp: 0, ubp: 0, penre: 0 }
      );

      // Transform materials to expected format
      const materials = element.materials.map((mat) => {
        const kbobMatch = mat.material?.kbobMatch;
        return {
          material: {
            name: mat.material?.name || "Unknown",
            density: mat.material?.density || 0,
            kbobMatch: kbobMatch
              ? {
                Name:
                  kbobMatch.Name ||
                  kbobMatch.nameDE ||
                  kbobMatch.nameFR ||
                  mat.material?.name ||
                  "Unknown",
                GWP: getGWP(kbobMatch),
                UBP: getUBP(kbobMatch),
                PENRE: getPENRE(kbobMatch),
              }
              : undefined,
          },
          volume: mat.volume || 0,
        };
      });

      return {
        _id: element._id,
        name: element.name || "Unknown",
        type: element.type || "Unknown",
        totalVolume: element.totalVolume || 0,
        emissions,
        materials,
      };
    }
  );

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
            columns={emissionsColumns(indicator)}
            data={emissionRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
