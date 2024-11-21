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
      layerId?: string;
      layerName?: string;
    }>;
  };
}

export class IFCParserAdapter {
  private extractor: IFCElementExtractor;

  constructor(content: string) {
    console.log('[DEBUG] Creating IFCParserAdapter');
    console.log('[DEBUG] Content length:', content.length);
    
    try {
      this.extractor = new IFCElementExtractor(content);
    } catch (error) {
      console.error('[DEBUG] Error creating IFCElementExtractor:', error);
      throw error;
    }
  }

  async parseContent(): Promise<IFCElement[]> {
    console.log('[DEBUG] Starting parseContent in IFCParserAdapter');
    try {
      const elements = this.extractor.extractElements();
      console.log('[DEBUG] Elements extracted:', Object.keys(elements).length);
      
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
            thickness: material.volume ? parseFloat(material.volume.toString()) : 0,
            layerId: material.id,
            layerName: material.name
          }))
        } : undefined
      }));

      console.log('[DEBUG] Transformed elements:', transformedElements.length);
      return transformedElements;
    } catch (error) {
      console.error('[DEBUG] Error in parseContent:', error);
      throw error;
    }
  }
}