import { NextResponse } from "next/server";
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

/**
 * Turns thrown errors into JSON responses with an `error` message, so the UI
 * always gets something it can show. Unknown errors are logged and returned
 * as 500 without internals.
 */
export function toErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, message: error.message },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    const message = error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }
  logger.error(`${context} failed`, error);
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
