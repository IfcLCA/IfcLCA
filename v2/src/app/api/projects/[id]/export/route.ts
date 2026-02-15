import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, elements, elementMaterials } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/export
 *
 * Export project LCA results as a STEP-format IFC patch file.
 * Returns element GUIDs with their calculated indicators as JSON,
 * which the client can use to generate enriched IFC output.
 *
 * For now, returns a structured JSON export that can be used to
 * create CPset_IfcLCA property sets. Full IFC binary writing
 * requires a STEP file writer which is deferred to a future phase.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all elements with aggregated indicators
  const rows = await db
    .select({
      guid: elements.guid,
      name: elements.name,
      type: elements.type,
      gwpTotal: sql<number>`COALESCE(SUM(${elementMaterials.gwpTotal}), 0)`,
      penreTotal: sql<number>`COALESCE(SUM(${elementMaterials.penreTotal}), 0)`,
      ubp: sql<number>`COALESCE(SUM(${elementMaterials.ubp}), 0)`,
      volume: sql<number>`COALESCE(SUM(${elementMaterials.volume}), 0)`,
    })
    .from(elements)
    .leftJoin(elementMaterials, eq(elementMaterials.elementId, elements.id))
    .where(eq(elements.projectId, projectId))
    .groupBy(elements.id);

  const hasResults = rows.filter(
    (r) => r.gwpTotal !== 0 || r.penreTotal !== 0 || r.ubp !== 0
  );

  // Build IFC property set data for each element
  const ifcPropertySets = hasResults.map((row) => ({
    elementGuid: row.guid,
    elementName: row.name,
    elementType: row.type,
    propertySetName: "CPset_IfcLCA",
    properties: [
      {
        name: "GWP",
        value: Math.round(row.gwpTotal * 100) / 100,
        unit: "kg CO2-eq",
        type: "IfcReal",
      },
      {
        name: "PENRE",
        value: Math.round(row.penreTotal * 100) / 100,
        unit: "MJ",
        type: "IfcReal",
      },
      {
        name: "UBP",
        value: Math.round(row.ubp),
        unit: "UBP",
        type: "IfcReal",
      },
      {
        name: "Volume",
        value: Math.round(row.volume * 10000) / 10000,
        unit: "m3",
        type: "IfcReal",
      },
    ],
  }));

  // Compute totals from actual element data (not cached project values, which may be stale)
  const computedGwp = rows.reduce((sum, r) => sum + (r.gwpTotal ?? 0), 0);
  const computedPenre = rows.reduce((sum, r) => sum + (r.penreTotal ?? 0), 0);
  const computedUbp = rows.reduce((sum, r) => sum + (r.ubp ?? 0), 0);

  const exportData = {
    projectName: project.name,
    projectId: project.id,
    exportedAt: new Date().toISOString(),
    dataSource: project.preferredDataSource,
    totals: {
      gwpTotal: Math.round(computedGwp * 100) / 100,
      penreTotal: Math.round(computedPenre * 100) / 100,
      ubpTotal: Math.round(computedUbp),
    },
    elementCount: rows.length,
    elementsWithResults: hasResults.length,
    elements: ifcPropertySets,
  };

  // Return as downloadable JSON
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-zA-Z0-9-_]/g, "_")}-lca-export.json"`,
    },
  });
}
