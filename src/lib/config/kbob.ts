/**
 * Configuration for KBOB API integration
 */

// Validate required environment variables
if (!process.env.KBOB_API_KEY) {
  throw new Error(
    "KBOB_API_KEY environment variable is required. Please set it in your .env.local file."
  );
}

export const KBOB_API_CONFIG = {
  baseUrl: process.env.KBOB_API_URL || "https://www.lcadata.ch",
  apiKey: process.env.KBOB_API_KEY,
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  syncInterval: 24 * 60 * 60 * 1000, // Sync every 24 hours
} as const;

