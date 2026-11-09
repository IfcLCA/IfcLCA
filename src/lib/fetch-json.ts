/**
 * fetch() for our own API routes. Throws an Error carrying the server's
 * `error` message on a non-2xx response, so callers can show it instead of
 * failing on response.json() or treating an error body as data.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}
