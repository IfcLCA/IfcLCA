import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { listActivities } from "@/lib/repositories/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("Loading activity", async (request: Request) => {
  const userId = await requireUserId();
  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "6", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 6;
  const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 1000) : 1;
  return NextResponse.json(await listActivities(userId, page, limit), {
    headers: { "Cache-Control": "no-store" },
  });
});
