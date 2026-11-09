import { NextResponse } from "next/server";
import { clampInt, requireUserId, route } from "@/lib/api";
import { listActivities } from "@/lib/repositories/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("Loading activity", async (request: Request) => {
  const userId = await requireUserId();
  const { searchParams } = new URL(request.url);
  const limit = clampInt(searchParams.get("limit"), 6, 1, 50);
  const page = clampInt(searchParams.get("page"), 1, 1, 1000);
  return NextResponse.json(await listActivities(userId, page, limit), {
    headers: { "Cache-Control": "no-store" },
  });
});
