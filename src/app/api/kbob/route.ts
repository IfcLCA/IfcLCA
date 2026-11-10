import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { listUsableKbobMaterials } from "@/lib/repositories/kbob";

export const dynamic = "force-dynamic";

// Public: the /try page uses it without an account. Reads the cache only;
// /api/kbob/sync refreshes it.
export const GET = route("Loading KBOB materials", async () => {
  return NextResponse.json(await listUsableKbobMaterials(), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
});
