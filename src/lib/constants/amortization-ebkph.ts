export interface AmortizationInfo {
  years: number;
  buildingRelated: boolean;
}

export const EBKP_AMORTIZATION: Record<string, AmortizationInfo> = {
  "B06.01": { years: 60, buildingRelated: true },
  "B06.02": { years: 60, buildingRelated: true },
  "B06.04": { years: 60, buildingRelated: true },
  "B07.02": { years: 60, buildingRelated: true },
  C01: { years: 60, buildingRelated: true },
  "C02.01": { years: 60, buildingRelated: true },
  "C02.02": { years: 60, buildingRelated: true },
  C03: { years: 60, buildingRelated: true },
  "C04.01": { years: 60, buildingRelated: true },
  "C04.04": { years: 60, buildingRelated: true },
  "C04.05": { years: 60, buildingRelated: true },
  "C04.08": { years: 40, buildingRelated: true },
  D01: { years: 30, buildingRelated: false },
  "D05.02": { years: 20, buildingRelated: false },
  "D05.02-ES": { years: 40, buildingRelated: false },
  "D05.02-SO": { years: 30, buildingRelated: false },
  "D05.04": { years: 30, buildingRelated: false },
  "D05.05": { years: 30, buildingRelated: false },
  "D07.": { years: 30, buildingRelated: false },
  D08: { years: 30, buildingRelated: false },
  E01: { years: 60, buildingRelated: true },
  "E02.01": { years: 30, buildingRelated: true },
  "E02.02": { years: 30, buildingRelated: true },
  "E02.03": { years: 40, buildingRelated: true },
  "E02.04": { years: 40, buildingRelated: true },
  "E02.05": { years: 40, buildingRelated: true },
  E03: { years: 30, buildingRelated: true },
  "F01.01": { years: 60, buildingRelated: true },
  "F01.02": { years: 30, buildingRelated: true },
  "F01.03": { years: 40, buildingRelated: true },
  F02: { years: 30, buildingRelated: true },
  G01: { years: 30, buildingRelated: true },
  G02: { years: 30, buildingRelated: true },
  G03: { years: 30, buildingRelated: true },
  G04: { years: 30, buildingRelated: true },
};

export function getAmortizationYears(code?: string): number {
  if (!code) return 60;
  // direct match
  if (EBKP_AMORTIZATION[code]) return EBKP_AMORTIZATION[code].years;
  // try prefix matching (e.g. D07.1 -> D07.)
  const entry = Object.entries(EBKP_AMORTIZATION).find(([key]) =>
    code.startsWith(key),
  );
  return entry ? entry[1].years : 60;
}
