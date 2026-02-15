import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  projects,
  elements,
  elementMaterials,
  materials,
  lcaMaterials,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/emissions
 *
 * Returns pre-aggregated emission data for charts and summaries:
 * - totals (gwp, penre, ubp)
 * - byElementType (IfcWall, IfcSlab, etc.)
 * - byMaterial (material name → indicators + volume)
 * - relative (per m²·a) if area is set
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

  // Aggregated by element type
  const byElementType = await db
    .select({
      type: elements.type,
      gwp: sql<number>`COALESCE(SUM(${elementMaterials.gwpTotal}), 0)`,
      penre: sql<number>`COALESCE(SUM(${elementMaterials.penreTotal}), 0)`,
      ubp: sql<number>`COALESCE(SUM(${elementMaterials.ubp}), 0)`,
      volume: sql<number>`COALESCE(SUM(${elementMaterials.volume}), 0)`,
      count: sql<number>`COUNT(DISTINCT ${elements.id})`,
    })
    .from(elementMaterials)
    .innerJoin(elements, eq(elementMaterials.elementId, elements.id))
    .where(eq(elements.projectId, projectId))
    .groupBy(elements.type)
    .orderBy(sql`SUM(${elementMaterials.gwpTotal}) DESC`);

  // Aggregated by material
  const byMaterial = await db
    .select({
      name: materials.name,
      gwp: sql<number>`COALESCE(SUM(${elementMaterials.gwpTotal}), 0)`,
      penre: sql<number>`COALESCE(SUM(${elementMaterials.penreTotal}), 0)`,
      ubp: sql<number>`COALESCE(SUM(${elementMaterials.ubp}), 0)`,
      volume: sql<number>`COALESCE(SUM(${elementMaterials.volume}), 0)`,
      density: materials.density,
      matchedTo: lcaMaterials.name,
    })
    .from(elementMaterials)
    .innerJoin(materials, eq(elementMaterials.materialId, materials.id))
    .leftJoin(lcaMaterials, eq(materials.lcaMaterialId, lcaMaterials.id))
    .where(eq(materials.projectId, projectId))
    .groupBy(materials.name)
    .orderBy(sql`SUM(${elementMaterials.gwpTotal}) DESC`);

  // Project totals
  const totals = {
    gwpTotal: project.gwpTotal ?? 0,
    penreTotal: project.penreTotal ?? 0,
    ubpTotal: project.ubpTotal ?? 0,
    calculatedAt: project.emissionsCalculatedAt,
  };

  // Relative emissions
  let relative = null;
  if (project.areaValue && project.areaValue > 0) {
    const amort = project.amortization ?? 50;
    const divisor = project.areaValue * amort;
    relative = {
      gwpPerM2Year: totals.gwpTotal / divisor,
      penrePerM2Year: totals.penreTotal / divisor,
      ubpPerM2Year: totals.ubpTotal / divisor,
      area: project.areaValue,
      areaType: project.areaType,
      amortization: amort,
    };
  }

  return NextResponse.json({
    totals,
    byElementType,
    byMaterial,
    relative,
  });
}
