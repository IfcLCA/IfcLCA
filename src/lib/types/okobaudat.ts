/**
 * Ökobaudat Type Definitions
 * Interfaces and types for ILCD+EPD format compliance
 */

// Ökobaudat API configuration
export const OKOBAUDAT_CONFIG = {
  baseUrl: process.env.OKOBAUDAT_API_URL || 'https://oekobaudat.de/OEKOBAU.DAT/resource',
  datastockId: process.env.OKOBAUDAT_DATASTOCK_ID || 'cd2bda71-760b-4fcc-8a0b-3877c10000a8',
  complianceA1: 'c0016b33-8cf7-415c-ac6e-deba0d21440c', // EN 15804+A1
  complianceA2: 'c0016b33-8cf7-415c-ac6e-deba0d21440d', // EN 15804+A2
  apiKey: process.env.OKOBAUDAT_API_KEY,
  cacheTTL: parseInt(process.env.OKOBAUDAT_API_CACHE_TTL || '86400', 10), // 24 hours
  rateLimit: parseInt(process.env.OKOBAUDAT_API_RATE_LIMIT || '100', 10), // requests per minute
};

// ILCD+EPD format interfaces
export interface ILCDEPDDataset {
  uuid: string;
  version: string;
  name: string;
  category: string;
  referenceFlow?: {
    amount: number;
    unit: string;
  };
  materialProperties?: {
    density?: number;
    grammage?: number;
    conversionFactorToKg?: number;
  };
  environmentalIndicators?: {
    gwp?: number;
    penre?: number;
    ubp?: number;
  };
}

export interface OkobaudatMaterial {
  uuid: string;
  name: string;
  category: string;
  density?: number;
  gwp: number;
  penre: number;
  ubp?: number;
  declaredUnit: string;
  referenceFlowAmount: number;
  compliance: string[];
  lastFetched: Date;
}

export interface OkobaudatSearchResult {
  materials: OkobaudatMaterial[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface OkobaudatMatchResult {
  material: OkobaudatMaterial;
  score: number;
}

