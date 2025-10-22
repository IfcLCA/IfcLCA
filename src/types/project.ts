// Base material type with reference to KBOB match
export interface MaterialWithMatchId {
  volume: number;
  material: {
    density?: number;
    kbobMatchId?: string; // ObjectId reference
    kbobMatch?: {
      GWP?: number;
      UBP?: number;
      PENRE?: number;
    };
  };
}

// Material type with populated KBOB match (after transformation)
export interface MaterialWithMatch {
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

// Base element type with reference
export interface ElementWithMatchId {
  materials: MaterialWithMatchId[];
  classification?: {
    system: string;
    code: string;
    name?: string;
  };
}

// Element type with populated match (after transformation)
export interface ElementWithMatch {
  materials: MaterialWithMatch[];
  classification?: {
    system: string;
    code: string;
    name?: string;
  };
}

// Project type with elements (can use either form depending on transformation state)
export interface Project {
  id: string;
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };
  classificationSystem?: string;
  emissions?: {
    gwp: number;
    ubp: number;
    penre: number;
  };
  elements?: ElementWithMatch[];
}

// ProjectEmissions type for emission calculations
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
