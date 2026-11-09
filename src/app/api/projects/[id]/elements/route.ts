import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { listElementsPage } from "@/lib/repositories/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

export const GET = route(
  "Loading elements",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = clampInt(searchParams.get("page"), 1, 1, 1_000_000);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
    return NextResponse.json(await listElementsPage(userId, id, page, limit));
  }
);
