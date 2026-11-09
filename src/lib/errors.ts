/**
 * Errors that route handlers turn into HTTP responses (see lib/api.ts).
 * Repositories throw these instead of returning null, so a missing or
 * foreign row can never be silently treated as success.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, "Unauthorized");
  }
}

/** Missing, or owned by someone else. Both look the same to the caller. */
export class NotFoundError extends HttpError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

/** A dependency (database, KBOB cache) is not usable right now. */
export class UnavailableError extends HttpError {
  constructor(message: string) {
    super(503, message);
  }
}
