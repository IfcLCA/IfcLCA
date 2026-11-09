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
 * `Authorization: Bearer $CRON_SECRET`. Open without a secret in development.
 */
function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return;
    throw new UnauthorizedError();
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
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
