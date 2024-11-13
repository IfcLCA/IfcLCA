export interface IFCElement {
  guid: string;
  name: string;
  type: string;
  volume: number;
  buildingStorey?: string;
  materials: IFCMaterial[];
}

export interface IFCMaterial {
  name: string;
  volume: number;
  fraction: number;
}

export interface IFCParseResult {
  elements: IFCElement[];
  error?: string;
  elementCount?: number;
  uploadId?: string;
}

export type UploadStatus = "Processing" | "Completed" | "Failed";

export interface UploadResult {
  id: string;
  status: UploadStatus;
  elementCount: number;
  error?: string;
}
