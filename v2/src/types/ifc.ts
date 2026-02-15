/**
 * Types for IFC data extracted by ifc-lite.
 *
 * These represent the parsed metadata from an IFC file,
 * before any LCA matching has happened.
 */

/** A single material layer within an element */
export interface IFCMaterialLayer {
  /** Material name as defined in the IFC file */
  name: string;
  /** Volume of this material layer in m³ */
  volume: number;
  /** Fraction of the element (0-1, all fractions sum to ~1) */
  fraction: number;
  /** Layer thickness in meters (for layered materials) */
  thickness?: number;
}

/** A parsed IFC building element */
export interface IFCElement {
  /** IFC GlobalId (unique per model) */
  guid: string;
  /** Element name (e.g., "Basic Wall:Interior - Partition") */
  name: string;
  /** IFC entity type (e.g., "IfcWall", "IfcSlab", "IfcColumn") */
  type: string;
  /** Whether the element is load-bearing */
  loadBearing: boolean;
  /** Whether the element is external */
  isExternal: boolean;
  /** Classification reference (e.g., eBKP-H) */
  classification?: {
    system: string;
    code: string;
    name: string;
  };
  /** Material layers (may have 1+ layers) */
  materials: IFCMaterialLayer[];
  /** Total volume of the element in m³ */
  totalVolume: number;
}

/** Summary of unique materials found across all elements */
export interface IFCMaterialSummary {
  /** Material name */
  name: string;
  /** Total volume across all elements using this material */
  totalVolume: number;
  /** Number of elements using this material */
  elementCount: number;
  /** IFC types that use this material */
  elementTypes: string[];
}

/** Result of parsing an IFC file */
export interface IFCParseResult {
  /** All extracted building elements */
  elements: IFCElement[];
  /** Summary of unique materials */
  materials: IFCMaterialSummary[];
  /** Project metadata from IFC header */
  projectInfo: {
    name?: string;
    description?: string;
    schema: string;
    application?: string;
  };
  /** Building storeys found */
  storeys: Array<{
    guid: string;
    name: string;
    elevation: number;
    /** Element GUIDs belonging to this storey */
    elementGuids: string[];
  }>;
  /** Parse timing stats */
  stats: {
    parseTimeMs: number;
    elementCount: number;
    materialCount: number;
    fileSizeBytes: number;
  };
}
