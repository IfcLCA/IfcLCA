import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { registry } from "@/lib/lca/registry";

export const dynamic = "force-dynamic";

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
    // Auto-sync: if a specific source has never been synced, sync now before searching
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
        await autoSyncPromise;
      }
    }

    let results;

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

    return NextResponse.json({ materials: results });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Search failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
