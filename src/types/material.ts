export interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

export interface IKBOBMaterial {
  _id: string;
  Name: string;
  Category: string;
  GWP: number;
  UBP: number;
  PENRE: number;
  "kg/unit"?: number;
  "min density"?: number;
  "max density"?: number;
}

export interface IMaterial {
  _id: string;
  name: string;
  projectId: string;
  kbobMatchId?: string;
  density?: number;
  gwp?: number;
  ubp?: number;
  penre?: number;
}

export interface MaterialChange {
  materialId: string;
  materialName: string;
  oldMatch: {
    Name: string;
    Density: number;
    Elements: number;
  } | null;
  newMatch: {
    id: string;
    Name: string;
    Density: number;
    Elements: number;
    hasDensityRange: boolean;
    minDensity?: number;
    maxDensity?: number;
  };
  projects: string[];
  projectId?: string;
  elements: number;
  selectedDensity?: number;
}

export interface IMaterialPreview {
  changes: MaterialChange[];
}
