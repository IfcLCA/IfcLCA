import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { materials, projects, lcaMaterials } from "@/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { registry } from "@/lib/lca/registry";
import { findBestMatch } from "@/lib/lca/matching";
import { cleanIfcQuery } from "@/lib/lca/preprocessing";
import type { NormalizedMaterial, MaterialMatch } from "@/types/lca";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToNormalized(row: typeof lcaMaterials.$inferSelect): NormalizedMaterial {
  return {
    id: row.id,
    sourceId: row.sourceId,
    source: row.source,
    name: row.name,
    category: row.category ?? "Uncategorized",
    density: row.density,
    unit: row.unit ?? "kg",
    indicators: {
      gwpTotal: row.gwpTotal,
      gwpFossil: row.gwpFossil,
      gwpBiogenic: row.gwpBiogenic,
      gwpLuluc: row.gwpLuluc,
      penreTotal: row.penreTotal,
      pereTotal: row.pereTotal,
      ap: row.ap,
      odp: row.odp,
      pocp: row.pocp,
      adpMineral: row.adpMineral,
      adpFossil: row.adpFossil,
      ubp: row.ubp,
    },
    metadata: {
      version: "current",
      lastSynced: row.updatedAt ?? new Date(),
    },
  };
}

// ---------------------------------------------------------------------------
// Route handler — streams progress via SSE if Accept: text/event-stream,
// otherwise returns JSON batch response for backwards compatibility.
// ---------------------------------------------------------------------------

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
  // These are narrowed to non-null above but TypeScript doesn't track into closures
  const verifiedUserId = userId!;
  const verifiedProjectId = projectId!;
  const verifiedNames = materialNames!;
  const wantsSSE = request.headers.get("accept")?.includes("text/event-stream");

  console.log(
    `[match] Auto-match started: ${verifiedNames.length} materials, source=${activeSource}, project=${projectId}, sse=${!!wantsSSE}`
  );

  // Core matching logic — shared between SSE and batch modes
  async function runMatching(
    onProgress?: (matched: number, total: number, materialName: string, result: unknown) => void
  ) {
    // Ensure synced
    if (registry.has(activeSource)) {
      const adapter = registry.get(activeSource);
      const lastSync = await adapter.getLastSyncTime();
      if (!lastSync) {
        console.log(`[match] Auto-syncing ${activeSource}...`);
        await adapter.sync();
      }
    }

    // Step 1: Reapply previous manual mappings
    const previousMappings = await db
      .select({
        materialName: materials.name,
        lcaMaterialId: materials.lcaMaterialId,
        matchSource: materials.matchSource,
        matchSourceId: materials.matchSourceId,
      })
      .from(materials)
      .innerJoin(projects, eq(materials.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, verifiedUserId),
          inArray(materials.name, verifiedNames),
          eq(materials.matchMethod, "manual"),
          isNotNull(materials.lcaMaterialId),
          eq(materials.matchSource, activeSource)
        )
      );

    const reapplyMap = new Map<
      string,
      { lcaMaterialId: string; matchSource: string; matchSourceId: string }
    >();
    for (const row of previousMappings) {
      if (row.lcaMaterialId && row.matchSource && !reapplyMap.has(row.materialName)) {
        reapplyMap.set(row.materialName, {
          lcaMaterialId: row.lcaMaterialId,
          matchSource: row.matchSource,
          matchSourceId: row.matchSourceId ?? "",
        });
      }
    }

    console.log(`[match] Found ${reapplyMap.size} previous manual mappings to reapply`);

    const reapplyLcaIds = [...reapplyMap.values()].map((v) => v.lcaMaterialId);
    const reapplyLcaRows =
      reapplyLcaIds.length > 0
        ? await db.select().from(lcaMaterials).where(inArray(lcaMaterials.id, reapplyLcaIds))
        : [];
    const reapplyLcaMaterialMap = new Map<string, NormalizedMaterial>();
    for (const row of reapplyLcaRows) {
      reapplyLcaMaterialMap.set(row.id, rowToNormalized(row));
    }

    // Step 2: Match each material
    const matches: Array<{
      materialName: string;
      match: MaterialMatch | null;
      matchedMaterial: NormalizedMaterial | null;
    }> = [];

    let matchedSoFar = 0;

    for (const materialName of verifiedNames) {
      try {
        // Priority 1: Reapply from previous manual mapping
        const prevMapping = reapplyMap.get(materialName);
        if (prevMapping) {
          const lcaMat = reapplyLcaMaterialMap.get(prevMapping.lcaMaterialId);
          if (lcaMat) {
            const match: MaterialMatch = {
              lcaMaterialId: prevMapping.lcaMaterialId,
              sourceId: prevMapping.matchSourceId,
              source: prevMapping.matchSource,
              score: 0.95,
              method: "reapplied",
              matchedAt: new Date(),
            };

            const [mat] = await db
              .select()
              .from(materials)
              .where(and(eq(materials.projectId, verifiedProjectId), eq(materials.name, materialName)))
              .limit(1);

            if (mat) {
              await db
                .update(materials)
                .set({
                  lcaMaterialId: match.lcaMaterialId,
                  matchSource: match.source,
                  matchSourceId: match.sourceId,
                  matchMethod: "reapplied",
                  matchScore: match.score,
                  matchedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(materials.id, mat.id));
            }

            console.log(`[match] REAPPLIED "${materialName}" → "${lcaMat.name}"`);
            const entry = { materialName, match, matchedMaterial: lcaMat };
            matches.push(entry);
            matchedSoFar++;
            onProgress?.(matchedSoFar, verifiedNames.length, materialName, entry);
            continue;
          }
        }

        // Priority 2: Auto-match via adapter search + scoring.
        // Each adapter handles its own query translation (EN→DE, keyword
        // extraction) and quality filtering (e.g. KBOB density > 0) internally.
        const adapter = registry.get(activeSource);
        const candidates = await adapter.search(materialName);

        if (candidates.length === 0) {
          console.log(`[match] NO CANDIDATES for "${materialName}"`);
          const entry = { materialName, match: null, matchedMaterial: null };
          matches.push(entry);
          onProgress?.(matchedSoFar, verifiedNames.length, materialName, entry);
          continue;
        }

        const searchQuery = cleanIfcQuery(materialName);
        const result = findBestMatch({ materialName: searchQuery }, candidates, 0.2);

        if (result.match && result.alternatives.length > 0) {
          const bestMaterial = result.alternatives[0].material;
          const autoMatch: MaterialMatch = { ...result.match, method: "auto" };

          const [mat] = await db
            .select()
            .from(materials)
            .where(and(eq(materials.projectId, verifiedProjectId), eq(materials.name, materialName)))
            .limit(1);

          if (mat) {
            await db
              .update(materials)
              .set({
                lcaMaterialId: autoMatch.lcaMaterialId,
                matchSource: autoMatch.source,
                matchSourceId: autoMatch.sourceId,
                matchMethod: "auto",
                matchScore: autoMatch.score,
                matchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(materials.id, mat.id));
          }

          console.log(
            `[match] AUTO "${materialName}" → "${bestMaterial.name}" (score=${autoMatch.score.toFixed(2)})`
          );
          const entry = { materialName, match: autoMatch, matchedMaterial: bestMaterial };
          matches.push(entry);
          matchedSoFar++;
          onProgress?.(matchedSoFar, verifiedNames.length, materialName, entry);
        } else {
          const topScore = result.alternatives[0]?.score;
          console.log(
            `[match] BELOW THRESHOLD "${materialName}" (best=${topScore?.toFixed(2) ?? "none"})`
          );
          const entry = { materialName, match: null, matchedMaterial: null };
          matches.push(entry);
          onProgress?.(matchedSoFar, verifiedNames.length, materialName, entry);
        }
      } catch (err) {
        console.error(`[match] ERROR "${materialName}":`, err instanceof Error ? err.message : err);
        const entry = { materialName, match: null, matchedMaterial: null };
        matches.push(entry);
        onProgress?.(matchedSoFar, verifiedNames.length, materialName, entry);
      }
    }

    const matched = matches.filter((m) => m.match).length;
    const reapplied = matches.filter((m) => m.match?.method === "reapplied").length;
    const auto = matches.filter((m) => m.match?.method === "auto").length;
    console.log(
      `[match] Auto-match complete: ${matched}/${verifiedNames.length} (${reapplied} reapplied, ${auto} auto)`
    );

    return matches;
  }

  // -------------------------------------------------------------------------
  // SSE mode: stream progress per material
  // -------------------------------------------------------------------------
  if (wantsSSE) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runMatching((matched, total, materialName, result) => {
            const event = JSON.stringify({ matched, total, materialName, result });
            controller.enqueue(encoder.encode(`data: ${event}\n\n`));
          });
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // -------------------------------------------------------------------------
  // Batch mode: return all matches at once (backwards compatible)
  // -------------------------------------------------------------------------
  try {
    const matches = await runMatching();
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("[match] Auto-match failed:", err);
    return NextResponse.json(
      {
        error: "Auto-match failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
