import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { materials, projects } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { recalculateProject } from "@/lib/lca/calculations-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId as string | undefined;
  const materialName = body.materialName as string | undefined;
  const lcaMaterialId = body.lcaMaterialId as string | undefined;
  const source = body.source as string | undefined;
  const sourceId = body.sourceId as string | undefined;
  const method = body.method as string | undefined;
  const score = typeof body.score === "number" ? body.score : undefined;

  if (!projectId || !materialName || !lcaMaterialId) {
    return NextResponse.json(
      { error: "projectId, materialName, and lcaMaterialId are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Find the material
  const [material] = await db
    .select()
    .from(materials)
    .where(
      and(eq(materials.projectId, projectId), eq(materials.name, materialName))
    )
    .limit(1);

  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  // Update match
  console.log(
    `[match] MANUAL "${materialName}" → lcaId=${lcaMaterialId} source=${source} method=${method ?? "manual"} score=${score ?? 1.0}`
  );
  await db
    .update(materials)
    .set({
      lcaMaterialId,
      matchSource: source ?? null,
      matchSourceId: sourceId ?? null,
      matchMethod: (method ?? "manual") as string,
      matchScore: score ?? 1.0,
      matchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(materials.id, material.id));

  // Recalculate project emissions with new match
  const calcResult = await recalculateProject(projectId).catch((err) => {
    console.error("[match] Recalculation failed:", err);
    return null;
  });

  return NextResponse.json({ success: true, emissions: calcResult?.totals });
}

/**
 * DELETE — Clear all material matches for a project.
 * Used when switching data source to avoid stale cross-source matches.
 */
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Clear all matches for this project
  await db
    .update(materials)
    .set({
      lcaMaterialId: null,
      matchSource: null,
      matchSourceId: null,
      matchMethod: null,
      matchScore: null,
      matchedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(materials.projectId, projectId),
        isNotNull(materials.lcaMaterialId)
      )
    );

  // Recalculate with cleared matches
  await recalculateProject(projectId).catch((err) => {
    console.error("[match/DELETE] Recalculation failed:", err);
  });

  return NextResponse.json({ success: true });
}
