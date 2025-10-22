import { useMemo } from "react";
import { getAmortizationYears } from "@/lib/utils/amortization";

interface Material {
  volume: number;
  material: {
    density?: number;
    kbobMatch?: {
      GWP?: number;
      UBP?: number;
      PENRE?: number;
    };
  };
}

interface Element {
  materials: Material[];
  classification?: {
    system: string;
    code: string;
    name?: string;
  };
}

export type Project = {
  elements: Element[];
  emissions?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };
};

export interface ProjectEmissions {
  totals: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  formatted: {
    gwp: string;
    ubp: string;
    penre: string;
  };
  units: {
    gwp: string;
    ubp: string;
    penre: string;
  };
}

const MILLION = 1_000_000;

const ABSOLUTE_UNITS: ProjectEmissions["units"] = {
  gwp: "kg CO₂ eq",
  ubp: "UBP",
  penre: "kWh oil-eq",
};

const defaultEmissions: ProjectEmissions = {
  totals: { gwp: 0, ubp: 0, penre: 0 },
  formatted: {
    gwp: "0",
    ubp: "0",
    penre: "0",
  },
  units: ABSOLUTE_UNITS,
};

const formatTotals = (
  totals: ProjectEmissions["totals"],
  fractionDigits = 0
): ProjectEmissions["formatted"] =>
  Object.entries(totals).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]:
        value >= MILLION
          ? `${(value / MILLION).toLocaleString("de-CH", {
              maximumFractionDigits: Math.max(1, fractionDigits),
              minimumFractionDigits: Math.min(3, Math.max(1, fractionDigits)),
            })} Mio.`
          : value.toLocaleString("de-CH", {
              maximumFractionDigits: fractionDigits,
            }),
    }),
    {} as ProjectEmissions["formatted"]
  );

const getRelativeUnits = (unit?: string): ProjectEmissions["units"] => ({
  gwp: `kg CO₂ eq/${unit || "m²"}·a`,
  ubp: `UBP/${unit || "m²"}·a`,
  penre: `kWh/${unit || "m²"}·a`,
});

export function useProjectEmissions(
  project?: Project,
  displayMode: 'absolute' | 'relative' = 'absolute'
): ProjectEmissions {
  return useMemo(() => {
    if (!project?.elements?.length) {
      if (displayMode === "absolute" && project?.emissions) {
        return {
          totals: project.emissions,
          formatted: formatTotals(project.emissions),
          units: ABSOLUTE_UNITS,
        };
      }

      return {
        ...defaultEmissions,
        units: displayMode === "relative"
          ? getRelativeUnits(project?.calculationArea?.unit)
          : ABSOLUTE_UNITS,
      };
    }

    // Calculate totals from elements
    const totals = project.elements.reduce(
      (acc, element) => {
        if (!element?.materials?.length) return acc;

        const amortYears = getAmortizationYears(element.classification);

        element.materials.forEach((mat) => {
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const kbob = mat.material?.kbobMatch;

          let gwp = volume * density * (kbob?.GWP || 0);
          let ubp = volume * density * (kbob?.UBP || 0);
          let penre = volume * density * (kbob?.PENRE || 0);

          // Apply relative calculation if mode is relative and area exists
          if (displayMode === 'relative' && project.calculationArea?.value) {
            const divisor = amortYears * project.calculationArea.value;
            gwp /= divisor;
            ubp /= divisor;
            penre /= divisor;
          }

          acc.gwp += gwp;
          acc.ubp += ubp;
          acc.penre += penre;
        });
        return acc;
      },
      { gwp: 0, ubp: 0, penre: 0 }
    );

    // Format numbers consistently
    const fractionDigits = displayMode === "relative" ? 3 : 0;
    const formatted = formatTotals(totals, fractionDigits);

    const units =
      displayMode === "relative"
        ? getRelativeUnits(project?.calculationArea?.unit)
        : ABSOLUTE_UNITS;

    return {
      totals,
      formatted,
      units,
    };
  }, [project, displayMode]);
}
