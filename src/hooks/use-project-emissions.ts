import { useMemo } from "react";

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
}

export type Project = {
  elements: {
    materials: {
      volume: number;
      material: {
        density?: number;
        kbobMatch?: {
          GWP?: number;
          UBP?: number;
          PENRE?: number;
        };
      };
    }[];
  }[];
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

export function useProjectEmissions(project?: Project): ProjectEmissions {
  return useMemo(() => {
    if (!project?.elements?.length) {
      return defaultEmissions;
    }

    // Calculate totals from elements
    const totals = project.elements.reduce(
      (acc, element) => {
        if (!element?.materials?.length) return acc;

        element.materials.forEach((mat) => {
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const kbob = mat.material?.kbobMatch;

          acc.gwp += volume * density * (kbob?.GWP || 0);
          acc.ubp += volume * density * (kbob?.UBP || 0);
          acc.penre += volume * density * (kbob?.PENRE || 0);
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

    return {
      totals,
      formatted,
      units: defaultEmissions.units,
    };
  }, [project]);
}
