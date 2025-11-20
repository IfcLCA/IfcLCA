export interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

export interface IKBOBMaterial {
  _id: string;
  Name: string;
  Category?: string;
  // Legacy fields (for backward compatibility)
  GWP?: number;
  UBP?: number;
  PENRE?: number;
  KBOB_ID?: number;
  "kg/unit"?: number | string;
  "min density"?: number;
  "max density"?: number;
  // New API fields
  uuid?: string;
  nameDE?: string;
  nameFR?: string;
  group?: string;
  version?: string;
  lastUpdated?: Date;
  gwpTotal?: number | null;
  ubp21Total?: number | null;
  primaryEnergyNonRenewableTotal?: number | null;
  density?: number | string | null;
  unit?: string;
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
