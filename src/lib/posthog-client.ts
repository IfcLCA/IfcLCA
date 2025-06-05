import posthog from "posthog-js";
import PostHogClient from "./posthog";

// Client-side error tracking
export function captureClientError(
  error: Error,
  additionalProperties?: Record<string, any>
) {
  if (typeof window !== "undefined") {
    posthog.captureException(error, additionalProperties);
  }
}

// Server-side error tracking
export function captureServerError(
  error: Error,
  distinctId?: string,
  additionalProperties?: Record<string, any>
) {
  const client = PostHogClient();
  client.captureException(error, distinctId, additionalProperties);
}

// Universal error tracking (auto-detects client/server)
export function captureError(
  error: Error,
  additionalProperties?: Record<string, any>
) {
  if (typeof window !== "undefined") {
    // Client-side
    captureClientError(error, additionalProperties);
  } else {
    // Server-side
    captureServerError(error, undefined, additionalProperties);
  }
}
