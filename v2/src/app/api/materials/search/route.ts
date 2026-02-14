import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { registry } from "@/lib/lca/registry";

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
    let results;

    if (source) {
      if (!registry.has(source)) {
        return NextResponse.json(
          { error: `Unknown data source: "${source}". Available: ${registry.listIds().join(", ")}` },
          { status: 400 }
        );
      }
      // Search a specific data source
      const adapter = registry.get(source);
      results = await adapter.search(query, { category });
    } else {
      // Search all sources
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
