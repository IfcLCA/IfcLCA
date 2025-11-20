/**
 * Types for lcadata.ch KBOB API integration
 */

export interface KbobApiMaterial {
  uuid: string;
  nameDE: string;
  nameFR: string;
  group: string;
  density: string | number | null;
  unit: string;
  ubp21Total: number | null;
  gwpTotal: number | null;
  primaryEnergyNonRenewableTotal: number | null;
  [key: string]: any; // Allow additional fields
}

export interface KbobApiResponse {
  success: boolean;
  version: string;
  materials: KbobApiMaterial[];
  count: number;
  totalMaterials: number;
  totalPages: number;
  currentPage: number;
  pageSize: string;
}

export interface KbobApiVersionsResponse {
  success: boolean;
  versions: Array<{
    version: string;
    date: string;
    publishDate: string;
  }>;
  currentVersion: string;
}

