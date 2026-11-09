import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";
import { syncKbob } from "@/lib/kbob/sync";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Refreshes the KBOB cache from lcadata.ch.
 * Called daily by Vercel Cron (vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. The older KBOB_SYNC_SECRET still
 * works for manual calls. Open without any secret in development.
 */
function authorize(request: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.KBOB_SYNC_SECRET].filter(Boolean);
  if (secrets.length === 0) {
    if (process.env.NODE_ENV === "development") return;
    throw new UnauthorizedError();
  }
  const header = request.headers.get("authorization");
  if (!secrets.some((s) => header === `Bearer ${s}`)) {
    throw new UnauthorizedError();
  }
}

const handler = route("KBOB sync", async (request: Request) => {
  authorize(request);
  const result = await syncKbob(db);
  logger.info("[KBOB sync] done", result);
  return NextResponse.json({ success: true, ...result });
});

export const GET = handler;
export const POST = handler;
