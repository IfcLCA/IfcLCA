"use client";

import { useEffect } from "react";

export function TestError() {
  useEffect(() => {
    // Check if we should throw a test error
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("test-error")
    ) {
      // Wait a bit for PostHog to initialize
      setTimeout(() => {
        throw new Error(
          "Test error for PostHog tracking - this is intentional for testing!"
        );
      }, 2000);
    }
  }, []);

  return null;
}
