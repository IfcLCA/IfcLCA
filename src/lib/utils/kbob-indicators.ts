/**
 * Utility functions for extracting environmental indicators from KBOB materials
 * Supports both legacy (GWP, UBP, PENRE) and new API (gwpTotal, ubp21Total, primaryEnergyNonRenewableTotal) formats
 */

interface KbobMaterialLike {
  // Legacy fields
  GWP?: number | null;
  UBP?: number | null;
  PENRE?: number | null;
  
  // New API fields
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
}

/**
 * Extract GWP value from KBOB material (supports both formats)
 */
export function getGWP(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;
  
  // Prefer new API format, fallback to legacy
  if (kbob.gwpTotal !== null && kbob.gwpTotal !== undefined) {
    return kbob.gwpTotal;
  }
  
  if (kbob.GWP !== null && kbob.GWP !== undefined) {
    return kbob.GWP;
  }
  
  return 0;
}

/**
 * Extract UBP value from KBOB material (supports both formats)
 */
export function getUBP(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;
  
  // Prefer new API format, fallback to legacy
  if (kbob.ubp21Total !== null && kbob.ubp21Total !== undefined) {
    return kbob.ubp21Total;
  }
  
  if (kbob.UBP !== null && kbob.UBP !== undefined) {
    return kbob.UBP;
  }
  
  return 0;
}

/**
 * Extract PENRE value from KBOB material (supports both formats)
 */
export function getPENRE(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;
  
  // Prefer new API format, fallback to legacy
  if (kbob.primaryEnergyNonRenewableTotal !== null && kbob.primaryEnergyNonRenewableTotal !== undefined) {
    return kbob.primaryEnergyNonRenewableTotal;
  }
  
  if (kbob.PENRE !== null && kbob.PENRE !== undefined) {
    return kbob.PENRE;
  }
  
  return 0;
}

/**
 * Extract all environmental indicators from KBOB material
 */
export function getIndicators(kbob: KbobMaterialLike | null | undefined): {
  gwp: number;
  ubp: number;
  penre: number;
} {
  return {
    gwp: getGWP(kbob),
    ubp: getUBP(kbob),
    penre: getPENRE(kbob),
  };
}

