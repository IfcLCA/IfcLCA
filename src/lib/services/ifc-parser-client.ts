import { IFCParser } from "./ifc-parser";
import { IFCParseResult } from "../types/ifc";

export async function parseIFCFile(file: File): Promise<IFCParseResult> {
  const content = await file.text();
  const parser = new IFCParser();
  const parseResult = await parser.parseContent(content);

  return {
    elements: parseResult.map((element) => ({
      guid: element.globalId,
      name: element.name,
      type: element.type,
      volume: element.netVolume || 0,
      buildingStorey: element.spatialContainer,
      materials:
        element.materialLayers?.layers?.map((layer) => ({
          name: layer.materialName || "Unknown",
          volume: Number((layer.thickness || 0) * (element.netVolume || 0)),
          fraction: Number(layer.thickness || 0),
        })) || [],
    })),
  };
}
