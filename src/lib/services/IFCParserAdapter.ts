import { IFCElementExtractor } from './ifc-parser';

export interface IFCElement {
  globalId: string;
  type: string;
  name?: string;
  netVolume?: number;
  spatialContainer?: string;
  materialLayers?: {
    layerSetName?: string;
    layers: Array<{
      materialName: string;
      thickness: number;
      volume?: number;
      layerId?: string;
      layerName?: string;
    }>;
  };
}

export class IFCParserAdapter {
  private extractor: IFCElementExtractor;

  constructor(content: string) {
    try {
      this.extractor = new IFCElementExtractor(content);
    } catch (error) {
      throw error;
    }
  }

  async parseContent(): Promise<IFCElement[]> {
    try {
      const elements = this.extractor.extractElements();

      const transformedElements = Object.values(elements).flat().map(element => ({
        globalId: element.id,
        type: element.type,
        name: element.name || element.type,
        netVolume: element.volume,
        spatialContainer: element.spatialContainer,
        materialLayers: element.materials?.length ? {
          layerSetName: `${element.type}_Layers`,
          layers: element.materials.map(material => ({
            materialName: material.name,
            thickness: material.fraction || 0,
            volume: material.volume || 0,
            layerId: material.id,
            layerName: material.name
          }))
        } : undefined
      }));

      return transformedElements;
    } catch (error) {
      throw error;
    }
  }
}