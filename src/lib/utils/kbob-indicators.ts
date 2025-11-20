/**
 * Utility functions for extracting environmental indicators from KBOB materials
 * Uses new API format (gwpTotal, ubp21Total, primaryEnergyNonRenewableTotal)
 */

interface KbobMaterialLike {
  // New API fields
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
}

/**
 * Extract GWP value from KBOB material
 */
export function getGWP(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;

  if (kbob.gwpTotal !== null && kbob.gwpTotal !== undefined) {
    return kbob.gwpTotal;
  }

  return 0;
}

/**
 * Extract UBP value from KBOB material
 */
export function getUBP(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;

  if (kbob.ubp21Total !== null && kbob.ubp21Total !== undefined) {
    return kbob.ubp21Total;
  }

  return 0;
}

/**
 * Extract PENRE value from KBOB material
 */
export function getPENRE(kbob: KbobMaterialLike | null | undefined): number {
  if (!kbob) return 0;

  if (kbob.primaryEnergyNonRenewableTotal !== null && kbob.primaryEnergyNonRenewableTotal !== undefined) {
    return kbob.primaryEnergyNonRenewableTotal;
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

