import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { registry } from "@/lib/lca/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Track in-flight auto-sync to avoid duplicates */
let autoSyncPromise: Promise<void> | null = null;

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const source = searchParams.get("source");
  const category = searchParams.get("category") ?? undefined;

  if (!query.trim()) {
    return NextResponse.json({ materials: [] });
  }

  try {
    console.log(`[search] q="${query}" source=${source ?? "all"}`);

    // Auto-sync: if a specific source has never been synced, sync now
    if (source && registry.has(source)) {
      const adapter = registry.get(source);
      const lastSync = await adapter.getLastSyncTime();
      if (!lastSync) {
        console.log(`[search] No ${source} data found — auto-syncing...`);
        if (!autoSyncPromise) {
          autoSyncPromise = adapter
            .sync()
            .then((r) =>
              console.log(`[search] Auto-sync done: ${r.added} materials`)
            )
            .catch((err) =>
              console.error(`[search] Auto-sync failed:`, err)
            )
            .finally(() => {
              autoSyncPromise = null;
            });
        }
        const timeout = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Sync timed out after 30s")), 30_000)
        );
        try {
          await Promise.race([autoSyncPromise, timeout]);
        } catch (syncErr) {
          console.error(`[search] Sync timeout/error:`, syncErr);
        }
      }
    }

    // Each adapter handles its own query translation (EN→DE synonyms,
    // keyword extraction, density filtering) internally.
    let results: Awaited<ReturnType<typeof registry.searchAll>>;

    if (source) {
      if (!registry.has(source)) {
        return NextResponse.json(
          { error: `Unknown data source: "${source}". Available: ${registry.listIds().join(", ")}` },
          { status: 400 }
        );
      }
      const adapter = registry.get(source);
      results = await adapter.search(query, { category });
    } else {
      results = await registry.searchAll(query, { category });
    }

    console.log(`[search] Returning ${results.length} results`);
    return NextResponse.json({ materials: results });
  } catch (err) {
    console.error("[search] Error:", err);
    return NextResponse.json(
      {
        error: "Search failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
