import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { registry } from "@/lib/lca/registry";

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
  const { source } = body as Record<string, string | undefined>;

  if (!source || !registry.has(source)) {
    return NextResponse.json(
      {
        error: `Unknown data source: "${source}". Available: ${registry.listIds().join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const adapter = registry.get(source);
    const result = await adapter.sync();

    return NextResponse.json({
      source,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Sync failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
