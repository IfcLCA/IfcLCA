import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { materials, projects, lcaMaterials } from "@/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { registry } from "@/lib/lca/registry";
import { findBestMatch } from "@/lib/lca/matching";
import {
  cleanIfcQuery,
  extractOekobaudatSearchTerms,
  extractKbobSearchTerms,
} from "@/lib/lca/preprocessing";
import type { NormalizedMaterial, MaterialMatch } from "@/types/lca";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Auto-matching many materials can be slow

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
// Route handler
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

  const activeSource =
    source || project.preferredDataSource || "kbob";

  console.log(
    `[match] Auto-match started: ${materialNames.length} materials, source=${activeSource}, project=${projectId}`
  );

  try {
    // Ensure the data source is synced
    if (registry.has(activeSource)) {
      const adapter = registry.get(activeSource);
      const lastSync = await adapter.getLastSyncTime();
      if (!lastSync) {
        console.log(`[match] Auto-syncing ${activeSource}...`);
        await adapter.sync();
      }
    }

    // -----------------------------------------------------------------------
    // Step 1: Look up previous manual mappings by this user (reapply)
    // -----------------------------------------------------------------------
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
          eq(projects.userId, userId),
          inArray(materials.name, materialNames),
          eq(materials.matchMethod, "manual"),
          isNotNull(materials.lcaMaterialId),
          eq(materials.matchSource, activeSource)
        )
      );

    // Build lookup: material name → best previous mapping
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

    console.log(
      `[match] Found ${reapplyMap.size} previous manual mappings to reapply`
    );

    // Fetch LCA material records for reapply targets
    const reapplyLcaIds = [...reapplyMap.values()].map(
      (v) => v.lcaMaterialId
    );
    const reapplyLcaRows =
      reapplyLcaIds.length > 0
        ? await db
            .select()
            .from(lcaMaterials)
            .where(inArray(lcaMaterials.id, reapplyLcaIds))
        : [];
    const reapplyLcaMaterialMap = new Map<string, NormalizedMaterial>();
    for (const row of reapplyLcaRows) {
      reapplyLcaMaterialMap.set(row.id, rowToNormalized(row));
    }

    // -----------------------------------------------------------------------
    // Step 2: Match each material
    // -----------------------------------------------------------------------
    const matches: Array<{
      materialName: string;
      match: MaterialMatch | null;
      matchedMaterial: NormalizedMaterial | null;
    }> = [];

    for (const materialName of materialNames) {
      try {
        // --- Priority 1: Reapply from previous manual mapping ---
        const prevMapping = reapplyMap.get(materialName);
        if (prevMapping) {
          const lcaMat = reapplyLcaMaterialMap.get(
            prevMapping.lcaMaterialId
          );
          if (lcaMat) {
            const match: MaterialMatch = {
              lcaMaterialId: prevMapping.lcaMaterialId,
              sourceId: prevMapping.matchSourceId,
              source: prevMapping.matchSource,
              score: 0.95,
              method: "reapplied",
              matchedAt: new Date(),
            };

            // Persist
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

            console.log(
              `[match] REAPPLIED "${materialName}" → "${lcaMat.name}" (from previous manual mapping)`
            );
            matches.push({ materialName, match, matchedMaterial: lcaMat });
            continue;
          }
        }

        // --- Priority 2: Auto-match by search + scoring ---
        const adapter = registry.get(activeSource);
        const searchQuery = cleanIfcQuery(materialName);
        let candidates: NormalizedMaterial[] = [];

        if (activeSource === "oekobaudat") {
          const keywords = extractOekobaudatSearchTerms(materialName);
          console.log(`[match] Ökobaudat keywords for "${materialName}": ${keywords.join(", ")}`);
          for (const keyword of keywords) {
            candidates = await adapter.search(keyword);
            if (candidates.length > 0) {
              console.log(`[match] Found ${candidates.length} candidates for keyword "${keyword}"`);
              break;
            }
          }
        } else {
          // KBOB: translate EN/NL/FR queries to German search terms
          candidates = await adapter.search(searchQuery);
          console.log(`[match] KBOB search "${searchQuery}" → ${candidates.length} candidates`);

          if (candidates.length === 0) {
            const kbobTerms = extractKbobSearchTerms(materialName);
            console.log(`[match] KBOB translated terms for "${materialName}": ${kbobTerms.join(", ")}`);
            for (const term of kbobTerms) {
              candidates = await adapter.search(term);
              if (candidates.length > 0) {
                console.log(`[match] Found ${candidates.length} candidates for KBOB term "${term}"`);
                break;
              }
            }
          }

          // Last resort: raw name
          if (candidates.length === 0 && searchQuery !== materialName) {
            candidates = await adapter.search(materialName);
          }
        }

        if (candidates.length === 0) {
          console.log(
            `[match] NO CANDIDATES for "${materialName}" (cleaned: "${searchQuery}")`
          );
          matches.push({ materialName, match: null, matchedMaterial: null });
          continue;
        }

        // For KBOB, only consider candidates that have density set —
        // entries without density are not usable for LCA calculations
        if (activeSource === "kbob") {
          const before = candidates.length;
          candidates = candidates.filter((c) => c.density != null && c.density > 0);
          if (before !== candidates.length) {
            console.log(`[match] KBOB density filter: ${before} → ${candidates.length} candidates`);
          }
          if (candidates.length === 0) {
            console.log(`[match] NO CANDIDATES with density for "${materialName}"`);
            matches.push({ materialName, match: null, matchedMaterial: null });
            continue;
          }
        }

        // Always pick the best match unless score is really poor (< 0.2)
        const result = findBestMatch({ materialName: searchQuery }, candidates, 0.2);

        if (result.match && result.alternatives.length > 0) {
          const bestMaterial = result.alternatives[0].material;

          // Override method to "auto" for transparency
          const autoMatch: MaterialMatch = {
            ...result.match,
            method: "auto",
          };

          // Persist
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
            `[match] AUTO "${materialName}" → "${bestMaterial.name}" (score=${autoMatch.score.toFixed(2)}, method=${result.alternatives[0].method})`
          );
          matches.push({
            materialName,
            match: autoMatch,
            matchedMaterial: bestMaterial,
          });
        } else {
          const topScore = result.alternatives[0]?.score;
          console.log(
            `[match] BELOW THRESHOLD "${materialName}" (best=${topScore?.toFixed(2) ?? "none"}, candidates=${candidates.length})`
          );
          matches.push({ materialName, match: null, matchedMaterial: null });
        }
      } catch (err) {
        console.error(
          `[match] ERROR "${materialName}":`,
          err instanceof Error ? err.message : err
        );
        matches.push({ materialName, match: null, matchedMaterial: null });
      }
    }

    const matched = matches.filter((m) => m.match).length;
    const reapplied = matches.filter(
      (m) => m.match?.method === "reapplied"
    ).length;
    const auto = matches.filter((m) => m.match?.method === "auto").length;

    console.log(
      `[match] Auto-match complete: ${matched}/${materialNames.length} matched (${reapplied} reapplied, ${auto} auto)`
    );

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
