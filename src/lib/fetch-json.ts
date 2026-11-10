export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * fetch() for our own API routes. Throws an ApiError carrying the server's
 * `error` message and the status on a non-2xx response, so callers can show
 * it instead of failing on response.json() or treating an error body as data.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}
