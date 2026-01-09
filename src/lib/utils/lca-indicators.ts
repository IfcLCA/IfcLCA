/**
 * Utility functions for extracting environmental indicators from LCA materials
 * Supports multiple data sources: KBOB, ÖKOBAUDAT, OpenEPD
 */

import type { LcaDataSource, LcaMaterialSearchResult, LcaMaterialData, LcaMatch } from "@/lib/types/lca";

/**
 * Generic LCA material interface for indicator extraction
 */
interface LcaMaterialLike {
  // Unified format fields
  gwp?: number | null;
  ubp?: number | null;
  penre?: number | null;
  density?: number | null;
  source?: LcaDataSource;

  // KBOB-specific fields (for backward compatibility)
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
}

/**
 * Check if an LCA material has valid environmental indicators
 */
export function isValidLcaMaterial(
  material: LcaMaterialLike | null | undefined,
  source?: LcaDataSource
): boolean {
  if (!material) return false;

  // Get GWP value (required for all sources)
  const gwp = material.gwp ?? material.gwpTotal;
  const hasValidGwp = gwp !== null && gwp !== undefined;

  // Check density
  const hasValidDensity =
    material.density !== null &&
    material.density !== undefined &&
    material.density !== 0;

  // For KBOB, also require UBP and PENRE
  if (source === "kbob" || material.ubp21Total !== undefined) {
    const ubp = material.ubp ?? material.ubp21Total;
    const penre = material.penre ?? material.primaryEnergyNonRenewableTotal;

    const hasValidUbp = ubp !== null && ubp !== undefined;
    const hasValidPenre = penre !== null && penre !== undefined;

    // At least one indicator must be non-zero
    const hasNonZeroIndicator =
      (hasValidGwp && gwp !== 0) ||
      (hasValidUbp && ubp !== 0) ||
      (hasValidPenre && penre !== 0);

    return hasValidGwp && hasValidUbp && hasValidPenre && hasNonZeroIndicator && hasValidDensity;
  }

  // For other sources, only GWP is required
  return hasValidGwp && gwp !== 0 && hasValidDensity;
}

/**
 * Extract GWP value from LCA material
 */
export function getLcaGwp(material: LcaMaterialLike | null | undefined): number {
  if (!material) return 0;
  return material.gwp ?? material.gwpTotal ?? 0;
}

/**
 * Extract UBP value from LCA material (KBOB only)
 */
export function getLcaUbp(material: LcaMaterialLike | null | undefined): number | null {
  if (!material) return null;
  const value = material.ubp ?? material.ubp21Total;
  return value ?? null;
}

/**
 * Extract PENRE value from LCA material
 */
export function getLcaPenre(material: LcaMaterialLike | null | undefined): number | null {
  if (!material) return null;
  const value = material.penre ?? material.primaryEnergyNonRenewableTotal;
  return value ?? null;
}

/**
 * Extract density from LCA material
 */
export function getLcaDensity(material: LcaMaterialLike | null | undefined): number {
  if (!material) return 0;
  if (typeof material.density === "number") return material.density;
  if (typeof material.density === "string") {
    const parsed = parseFloat(material.density);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Get all environmental indicators from an LCA material
 */
export function getLcaIndicators(material: LcaMaterialLike | null | undefined): {
  gwp: number;
  ubp: number | null;
  penre: number | null;
} {
  return {
    gwp: getLcaGwp(material),
    ubp: getLcaUbp(material),
    penre: getLcaPenre(material),
  };
}

/**
 * Format GWP value for display
 */
export function formatGwp(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)} kg CO₂-eq`;
}

/**
 * Format UBP value for display
 */
export function formatUbp(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(0);
}

/**
 * Format PENRE value for display
 */
export function formatPenre(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)} MJ`;
}

/**
 * Get available indicators for a data source
 */
export function getSourceIndicators(source: LcaDataSource): ("gwp" | "ubp" | "penre")[] {
  switch (source) {
    case "kbob":
      return ["gwp", "ubp", "penre"];
    case "okobaudat":
      return ["gwp", "penre"];
    case "openepd":
      return ["gwp"];
    default:
      return ["gwp"];
  }
}

/**
 * Check if a source has a specific indicator
 */
export function sourceHasIndicator(
  source: LcaDataSource,
  indicator: "gwp" | "ubp" | "penre"
): boolean {
  return getSourceIndicators(source).includes(indicator);
}

/**
 * Get display info for an indicator
 */
export function getIndicatorInfo(indicator: "gwp" | "ubp" | "penre"): {
  name: string;
  fullName: string;
  unit: string;
  description: string;
} {
  switch (indicator) {
    case "gwp":
      return {
        name: "GWP",
        fullName: "Global Warming Potential",
        unit: "kg CO₂-eq/kg",
        description: "Climate change impact measured in CO₂ equivalents",
      };
    case "ubp":
      return {
        name: "UBP",
        fullName: "Umweltbelastungspunkte",
        unit: "UBP/kg",
        description: "Swiss ecological scarcity method (eco-points)",
      };
    case "penre":
      return {
        name: "PENRE",
        fullName: "Primary Energy Non-Renewable",
        unit: "MJ/kg",
        description: "Non-renewable primary energy consumption",
      };
  }
}

/**
 * Calculate emissions for a material volume
 */
export function calculateEmissions(
  volume: number,
  density: number,
  indicators: { gwp: number; ubp?: number | null; penre?: number | null }
): { gwp: number; ubp: number; penre: number } {
  const mass = volume * density;
  return {
    gwp: mass * indicators.gwp,
    ubp: mass * (indicators.ubp ?? 0),
    penre: mass * (indicators.penre ?? 0),
  };
}
