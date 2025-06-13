import { useMemo } from "react";
import { getAmortizationYears } from "@/lib/constants/amortization-ebkph";

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
  classification?: string;
  materials: Material[];
}

export type Project = {
  ebf?: number;
  elements: Element[];
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

export interface EmissionOptions {
  mode?: "absolute" | "yearly" | "perAreaYear";
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
  options?: EmissionOptions,
): ProjectEmissions {
  return useMemo(() => {
    if (!project?.elements?.length) {
      return defaultEmissions;
    }

    const mode = options?.mode || "absolute";

    // Calculate totals from elements
    const totals = project.elements.reduce(
      (acc, element) => {
        if (!element?.materials?.length) return acc;

        const years =
          mode === "absolute"
            ? 1
            : getAmortizationYears(element.classification);

        element.materials.forEach((mat) => {
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const kbob = mat.material?.kbobMatch;

          const factor = 1 / years;

          acc.gwp += volume * density * (kbob?.GWP || 0) * factor;
          acc.ubp += volume * density * (kbob?.UBP || 0) * factor;
          acc.penre += volume * density * (kbob?.PENRE || 0) * factor;
        });
        return acc;
      },
      { gwp: 0, ubp: 0, penre: 0 },
    );

    if (mode === "perAreaYear" && project.ebf && project.ebf > 0) {
      totals.gwp /= project.ebf;
      totals.ubp /= project.ebf;
      totals.penre /= project.ebf;
    }

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
      {} as ProjectEmissions["formatted"],
    );

    const units = {
      gwp: "kg CO₂ eq",
      ubp: "UBP",
      penre: "kWh oil-eq",
    };

    if (mode === "yearly") {
      units.gwp += "/a";
      units.ubp += "/a";
      units.penre += "/a";
    } else if (mode === "perAreaYear") {
      units.gwp += "/m²·a";
      units.ubp += "/m²·a";
      units.penre += "/m²·a";
    }

    return {
      totals,
      formatted,
      units,
    };
  }, [project, options]);
}
