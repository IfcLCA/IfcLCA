/**
 * Configuration for KBOB API integration
 */

export const KBOB_API_CONFIG = {
  baseUrl: process.env.KBOB_API_URL || "https://www.lcadata.ch",
  apiKey: process.env.KBOB_API_KEY || "SLST#2y9@&T#R^^pm8tJ%ZZerL5@MSXVZ@UnrtgB",
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  syncInterval: 24 * 60 * 60 * 1000, // Sync every 24 hours
} as const;

