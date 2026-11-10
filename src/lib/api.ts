import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type z, type ZodTypeAny } from "zod";
import { auth } from "@clerk/nextjs/server";
import { BadRequestError, HttpError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new BadRequestError("Request body must be JSON");
  }
  return schema.parse(json);
}

export function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

// "Cannot reach the database": Prisma codes, and the Node network codes that
// @prisma/adapter-pg passes through (ENOTFOUND is what a deleted host gives).
const UNREACHABLE_CODES = new Set([
  "P1001", "P1002", "P1008", "P1017",
  "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN",
]);

function isDatabaseUnreachable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && UNREACHABLE_CODES.has(error.code))
  );
}

/**
 * Turns thrown errors into JSON responses with an `error` message, so the UI
 * always gets something it can show. Unknown errors are logged and returned
 * as 500 without internals.
 */
function toErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }
  logger.error(`${context} failed`, error);
  if (isDatabaseUnreachable(error)) {
    return NextResponse.json(
      { error: "The database is not reachable right now. Try again in a minute." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: `${context} failed` }, { status: 500 });
}

type Handler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

export function route<Args extends unknown[]>(
  context: string,
  handler: Handler<Args>
): Handler<Args> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  };
}
