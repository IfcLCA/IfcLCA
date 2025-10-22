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

const defaultEmissions: ProjectEmissions = {
  totals: { gwp: 0, ubp: 0, penre: 0 },
  formatted: {
    gwp: "0",
    ubp: "0",
    penre: "0",
  },
  units: {
    gwp: "kg CO₂ eq",
    ubp: "UBP",
    penre: "kWh oil-eq",
  },
};

const MILLION = 1_000_000;

export function useProjectEmissions(
  project?: Project,
  displayMode: 'absolute' | 'relative' = 'absolute'
): ProjectEmissions {
  return useMemo(() => {
    if (!project?.elements?.length) {
      return defaultEmissions;
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
    const formatted = Object.entries(totals).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]:
          value >= MILLION
            ? `${(value / MILLION).toLocaleString("de-CH", {
              maximumFractionDigits: 3,
              minimumFractionDigits: 1,
            })} Mio.`
            : value.toLocaleString("de-CH", {
              maximumFractionDigits: 0,
            }),
      }),
      {} as ProjectEmissions["formatted"]
    );

    const units = displayMode === 'relative'
      ? {
        gwp: `kg CO₂ eq/${project?.calculationArea?.unit || 'm²'}·a`,
        ubp: `UBP/${project?.calculationArea?.unit || 'm²'}·a`,
        penre: `kWh/${project?.calculationArea?.unit || 'm²'}·a`
      }
      : { gwp: "kg CO₂ eq", ubp: "UBP", penre: "kWh oil-eq" };

    return {
      totals,
      formatted,
      units,
    };
  }, [project, displayMode]);
}
