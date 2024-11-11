export interface IFCParseResult {
  elements: Array<{
    guid: string;
    name: string;
    type: string;
    volume: number;
    buildingStorey?: string;
    materials: Array<{
      name: string;
      volume: number;
      fraction: number;
    }>;
  }>;
  uploadId?: string;
  elementCount?: number;
}
