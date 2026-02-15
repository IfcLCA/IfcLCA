/**
 * Project and entity types for the application layer.
 *
 * These represent the persisted data in MongoDB,
 * combining IFC data with LCA matching results.
 */

import type { IndicatorValues, MaterialMatch } from "./lca";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  imageUrl?: string;

  /** Classification system used (e.g., "eBKP-H", "Uniclass") */
  classificationSystem: string;

  /** Preferred LCA data source for this project */
  preferredDataSource: string;

  /** Calculation reference area */
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };

  /** Aggregated emissions */
  emissions?: {
    totals: IndicatorValues;
    lastCalculated: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  name: string;
  category?: string;
  density?: number;
  totalVolume: number;

  /** LCA match (replaces v1's kbobMatchId) */
  lcaMatch?: MaterialMatch;

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectElement {
  id: string;
  projectId: string;
  uploadId: string;
  guid: string;
  name: string;
  type: string;
  loadBearing: boolean;
  isExternal: boolean;

  classification?: {
    system: string;
    code: string;
    name: string;
  };

  materials: Array<{
    materialId: string;
    volume: number;
    fraction: number;
    thickness?: number;
    /** Pre-calculated indicators (volume × density × factor) */
    indicators?: IndicatorValues;
  }>;

  createdAt: Date;
}

export interface Upload {
  id: string;
  projectId: string;
  userId: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  elementCount: number;
  materialCount: number;
  createdAt: Date;
}
