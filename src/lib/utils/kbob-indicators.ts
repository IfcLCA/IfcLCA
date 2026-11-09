/**
 * Environmental indicators of a KBOB material, and the LCA arithmetic that
 * uses them. Shared by the server (repositories) and the client (tables).
 *
 * Emissions of one material layer = volume (m³) * density (kg/m³) * indicator per kg.
 */

interface KbobMaterialLike {
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
  density?: number | string | null;
}

export interface Indicators {
  gwp: number;
  ubp: number;
  penre: number;
}

/** KBOB densities arrive as numbers, numeric strings, "-" or "". */
export function parseDensity(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && value.trim() !== "-") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Usable for matching: all three indicators present, at least one non-zero,
 * and a positive density.
 */
export function isValidKbobMaterial(material: KbobMaterialLike | null | undefined): boolean {
  if (!material) return false;
  const values = [material.gwpTotal, material.ubp21Total, material.primaryEnergyNonRenewableTotal];
  if (values.some((v) => v === null || v === undefined)) return false;
  if (values.every((v) => v === 0)) return false;
  const density = parseDensity(material.density);
  return density !== null && density > 0;
}

export function getGWP(kbob: KbobMaterialLike | null | undefined): number {
  return kbob?.gwpTotal ?? 0;
}

export function getUBP(kbob: KbobMaterialLike | null | undefined): number {
  return kbob?.ubp21Total ?? 0;
}

export function getPENRE(kbob: KbobMaterialLike | null | undefined): number {
  return kbob?.primaryEnergyNonRenewableTotal ?? 0;
}

export function layerEmissions(
  volume: number | null | undefined,
  density: number | null | undefined,
  kbob: KbobMaterialLike | null | undefined
): Indicators {
  const mass = (volume || 0) * (density || 0);
  return { gwp: mass * getGWP(kbob), ubp: mass * getUBP(kbob), penre: mass * getPENRE(kbob) };
}

export function addIndicators(a: Indicators, b: Indicators): Indicators {
  return { gwp: a.gwp + b.gwp, ubp: a.ubp + b.ubp, penre: a.penre + b.penre };
}

export const ZERO_INDICATORS: Indicators = Object.freeze({ gwp: 0, ubp: 0, penre: 0 });
