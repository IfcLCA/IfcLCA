import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { registry } from "@/lib/lca/registry";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = registry.listInfo();

  // Add last sync time for each source
  const sourcesWithSync = await Promise.all(
    sources.map(async (info) => {
      const adapter = registry.get(info.id);
      const lastSynced = await adapter.getLastSyncTime();
      return { ...info, lastSynced };
    })
  );

  return NextResponse.json({ sources: sourcesWithSync });
}
