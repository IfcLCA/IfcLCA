import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { materials, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { registry } from "@/lib/lca/registry";
import { findBestMatch } from "@/lib/lca/matching";
import { cleanIfcQuery, extractOekobaudatSearchTerms } from "@/lib/lca/preprocessing";
import type { NormalizedMaterial, MaterialMatch } from "@/types/lca";

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
  const source = body.source as string | undefined;
  const materialNames = body.materialNames as string[] | undefined;

  if (!projectId || !materialNames || !Array.isArray(materialNames)) {
    return NextResponse.json(
      { error: "projectId and materialNames[] are required" },
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

  const activeSource = source || project.preferredDataSource || "kbob";

  try {
    // Ensure the data source is synced
    if (registry.has(activeSource)) {
      const adapter = registry.get(activeSource);
      const lastSync = await adapter.getLastSyncTime();
      if (!lastSync) {
        await adapter.sync();
      }
    }

    // Search for candidates per material, run matching
    const matches: Array<{
      materialName: string;
      match: MaterialMatch | null;
      matchedMaterial: NormalizedMaterial | null;
    }> = [];

    for (const materialName of materialNames) {
      try {
        const adapter = registry.get(activeSource);

        // Preprocess query: clean IFC noise, then use keyword extraction
        // for Ökobaudat (AND full-text search needs single German keywords)
        let searchQuery = cleanIfcQuery(materialName);
        let candidates: NormalizedMaterial[] = [];

        if (activeSource === "oekobaudat") {
          // Ökobaudat: try each extracted keyword until we get results
          const keywords = extractOekobaudatSearchTerms(materialName);
          for (const keyword of keywords) {
            candidates = await adapter.search(keyword);
            if (candidates.length > 0) break;
          }
        } else {
          candidates = await adapter.search(searchQuery);
          // If no results with cleaned query, try original
          if (candidates.length === 0 && searchQuery !== materialName) {
            candidates = await adapter.search(materialName);
          }
        }

        const result = findBestMatch(
          { materialName },
          candidates,
          0.7 // lower threshold for auto-match — includes fuzzy
        );

        if (result.match && result.alternatives.length > 0) {
          const bestMaterial = result.alternatives[0].material;

          // Persist to DB
          const [mat] = await db
            .select()
            .from(materials)
            .where(
              and(
                eq(materials.projectId, projectId),
                eq(materials.name, materialName)
              )
            )
            .limit(1);

          if (mat) {
            await db
              .update(materials)
              .set({
                lcaMaterialId: result.match.lcaMaterialId,
                matchSource: result.match.source,
                matchSourceId: result.match.sourceId,
                matchMethod: result.match.method,
                matchScore: result.match.score,
                matchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(materials.id, mat.id));
          }

          matches.push({
            materialName,
            match: result.match,
            matchedMaterial: bestMaterial,
          });
        } else {
          matches.push({ materialName, match: null, matchedMaterial: null });
        }
      } catch {
        matches.push({ materialName, match: null, matchedMaterial: null });
      }
    }

    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Auto-match failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
