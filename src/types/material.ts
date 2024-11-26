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

export interface IMaterialChange {
  materialId: string;
  materialName: string;
  oldKbobMatch?: string;
  newKbobMatch: string;
  oldDensity?: number;
  newDensity: number;
  affectedElements: number;
  projects: string[];
}

export interface IMaterialPreview {
  changes: IMaterialChange[];
}
