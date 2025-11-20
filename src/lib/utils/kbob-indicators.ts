/**
 * Utility functions for extracting environmental indicators from KBOB materials
 * Uses new API format (gwpTotal, ubp21Total, primaryEnergyNonRenewableTotal)
 */

interface KbobMaterialLike {
  // New API fields
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
  density?: number | string | null;
}

/**
 * Check if a KBOB material has valid emissions and density
 * A material is considered valid if:
 * - All three environmental indicators exist and are not null
 * - At least one environmental indicator is non-zero
 * - Density exists and is non-zero
 */
export function isValidKbobMaterial(material: KbobMaterialLike | null | undefined): boolean {
  if (!material) return false;

  // Check if material has valid environmental indicators
  const hasValidGWP = material.gwpTotal !== null && material.gwpTotal !== undefined;
  const hasValidUBP = material.ubp21Total !== null && material.ubp21Total !== undefined;
  const hasValidPENRE = material.primaryEnergyNonRenewableTotal !== null && material.primaryEnergyNonRenewableTotal !== undefined;

  // At least one indicator must be non-zero
  const hasNonZeroIndicator =
    (hasValidGWP && material.gwpTotal !== 0) ||
    (hasValidUBP && material.ubp21Total !== 0) ||
    (hasValidPENRE && material.primaryEnergyNonRenewableTotal !== 0);

  // Check if material has valid density
  const hasValidDensity =
    material.density !== null &&
    material.density !== undefined &&
    material.density !== "" &&
    material.density !== "-" &&
    material.density !== 0;

  return hasValidGWP && hasValidUBP && hasValidPENRE && hasNonZeroIndicator && hasValidDensity;
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

