interface Material {
  name: string;
  fraction: number;
  count: number;
  layerSetName: string;
  volume?: number;
}

interface IFCElement {
  id: string;
  type: string;
  name: string;
  buildingStory?: string;
  materials: Material[];
  volume?: string;
}

interface IFCElementCollection {
  [key: string]: IFCElement[];
}

interface IFCMaterial {
  name: string;
  volume?: number | string;
}

interface IFCExtractedElement {
  id: string;
  type: string;
  name?: string;
  materials?: IFCMaterial[];
}

export class IFCElementExtractor {
  private entities: Map<string, any> = new Map();
  private relationships: Map<string, { materials: any[], spatialStructure?: any }> = new Map();
  private materialIndex: Map<string, IFCMaterial> = new Map();
  private entityTypeIndex: Map<string, Set<string>> = new Map();
  private propertySetIndex: Map<string, any> = new Map();
  private volumeCache: Map<string, string> = new Map();
  private state = {
    currentLine: 0,
    inDataSection: false,
    inHeader: false
  };

  private content: string;
  private elements: { [key: string]: IFCExtractedElement[] } = {};

  constructor(content: string) {
    this.content = content;
    this.parseIFCFile(content);
    this.buildPropertySetIndex();
    this.processMaterialRelationships();
    this.parseContent();
  }

  private stripHashFromId(id: string): string {
    return id.startsWith('#') ? id.substring(1) : id;
  }

  private parseList(list: string): string[] {
    if (!list) return [];
    // Handle nested parentheses
    let result = [];
    let currentItem = '';
    let depth = 0;

    for (let i = 0; i < list.length; i++) {
      const char = list[i];
      if (char === '(') {
        depth++;
        if (depth === 1 && currentItem === '') continue;
        currentItem += char;
      } else if (char === ')') {
        depth--;
        if (depth === 0 && currentItem !== '') {
          result.push(currentItem.trim());
          currentItem = '';
        } else {
          currentItem += char;
        }
      } else if (char === ',' && depth === 0) {
        if (currentItem !== '') {
          result.push(currentItem.trim());
          currentItem = '';
        }
      } else {
        currentItem += char;
      }
    }

    if (currentItem !== '') {
      result.push(currentItem.trim());
    }

    return result;
  }

  private parseLine(line: string): { id: string, type: string, attributes: string[] } | null {
    const match = line.match(/^#(\d+)=\s*(\w+)\((.*)\);?$/);
    if (!match) return null;

    const [, id, type, attributesStr] = match;
    const attributes = this.parseList(attributesStr);
    return { id, type, attributes };
  }

  private parseIFCFile(content: string): void {
    const lines = content.split('\n');
    let entityCount = 0;

    // Pre-compile regular expressions
    const lineRegex = /^#(\d+)=\s*(\w+)\((.*)\);?$/;
    const materialRegex = /'([^']+)'/;

    for (const line of lines) {
      this.state.currentLine++;
      const trimmedLine = line.trim();

      // Skip empty lines and section markers efficiently
      if (!trimmedLine || trimmedLine === 'ISO-10303-21;' || trimmedLine === 'HEADER;' || trimmedLine === 'ENDSEC;') continue;

      if (trimmedLine === 'DATA;') {
        this.state.inDataSection = true;
        continue;
      }

      // Only parse entity definitions in the data section
      if (!this.state.inDataSection) continue;

      // Use pre-compiled regex for better performance
      const match = trimmedLine.match(lineRegex);
      if (!match) continue;

      const [, id, type, attributesStr] = match;

      // Index materials during initial parse to avoid second pass
      if (type === 'IFCMATERIAL') {
        const nameMatch = attributesStr.match(materialRegex);
        if (nameMatch) {
          this.materialIndex.set('#' + id, {
            name: nameMatch[1],
            volume: this.extractVolume(trimmedLine)
          });
        }
      }

      // Index entities by type for faster lookups
      let typeSet = this.entityTypeIndex.get(type);
      if (!typeSet) {
        typeSet = new Set();
        this.entityTypeIndex.set(type, typeSet);
      }
      typeSet.add(id);

      // Clean and store entity
      const attributes = this.parseList(attributesStr);
      const cleanAttributes = attributes.map(attr => {
        return attr === '$' ? '' :
          (attr.startsWith("'") && attr.endsWith("'")) ? attr.slice(1, -1) :
            attr;
      });

      this.entities.set(id, {
        id,
        type,
        attributes: cleanAttributes,
        name: cleanAttributes[1] && cleanAttributes[1] !== '' ? cleanAttributes[1] : ''
      });
      entityCount++;

      if (entityCount % 1000 === 0) {
        console.log(`Parsed ${entityCount} entities...`);
      }
    }
    console.log(`Parsed ${entityCount} entities total`);
    console.log(`Indexed ${this.materialIndex.size} materials`);
    console.log(`Created type index with ${this.entityTypeIndex.size} types`);
  }

  private buildPropertySetIndex(): void {
    // Index all property and quantity sets for faster lookup
    for (const [id, entity] of this.entities.entries()) {
      if (entity.type === 'IFCRELDEFINESBYPROPERTIES') {
        const relatedObjects = this.parseList(entity.attributes[4]);
        const propertySetRef = this.stripHashFromId(entity.attributes[5]);

        for (const objRef of relatedObjects) {
          const elementId = this.stripHashFromId(objRef);
          let elementSets = this.propertySetIndex.get(elementId) || [];
          elementSets.push(propertySetRef);
          this.propertySetIndex.set(elementId, elementSets);
        }
      }
    }
  }

  private findElementVolume(element: any): string {
    // Check cache first
    const cachedVolume = this.volumeCache.get(element.id);
    if (cachedVolume !== undefined) {
      return cachedVolume;
    }

    try {
      const propertySets = this.propertySetIndex.get(element.id) || [];

      for (const setRef of propertySets) {
        const propertySet = this.entities.get(setRef);
        if (!propertySet) continue;

        // Try quantity set first (more reliable)
        const quantityVolume = this.checkQuantitySet(element, propertySet);
        if (quantityVolume) {
          this.volumeCache.set(element.id, quantityVolume);
          return quantityVolume;
        }

        // Fall back to property set
        const propertyVolume = this.checkPropertySet(propertySet);
        if (propertyVolume) {
          this.volumeCache.set(element.id, propertyVolume);
          return propertyVolume;
        }
      }
    } catch (error) {
      console.error("Error finding element volume:", error);
    }

    const defaultVolume = "0.000";
    this.volumeCache.set(element.id, defaultVolume);
    return defaultVolume;
  }

  private processMaterialRelationships(): void {
    let spatialCount = 0;
    let materialCount = 0;

    // Get all material relationships at once
    const materialRelations = Array.from(this.entities.values())
      .filter(entity => entity.type === 'IFCRELASSOCIATESMATERIAL');

    // Process spatial relationships first
    for (const entity of this.entities.values()) {
      if (entity.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
        const relatedElements = this.parseList(entity.attributes[4]);
        const storeyRef = this.stripHashFromId(entity.attributes[5]);
        const storey = this.entities.get(storeyRef);
        spatialCount += relatedElements.length;

        for (const elementRef of relatedElements) {
          const elementId = this.stripHashFromId(elementRef);
          const existing = this.relationships.get(elementId) || { materials: [] };
          existing.spatialStructure = storey;
          this.relationships.set(elementId, existing);
        }
      }
    }

    // Process material relationships in batches
    const batchSize = 100;
    for (let i = 0; i < materialRelations.length; i += batchSize) {
      const batch = materialRelations.slice(i, i + batchSize);

      for (const entity of batch) {
        const relatedElements = this.parseList(entity.attributes[4]);
        const materialRef = this.stripHashFromId(entity.attributes[5]);
        const materialEntity = this.entities.get(materialRef);
        materialCount += relatedElements.length;

        if (!materialEntity) continue;

        let materials: any[] = [];

        if (materialEntity.type === 'IFCMATERIALLAYERSETUSAGE') {
          materials = this.processMaterialLayerSet(materialEntity);
        } else if (materialEntity.type === 'IFCMATERIAL') {
          materials = [{
            name: this.removeQuotes(materialEntity.attributes[0] || 'Unknown Material'),
            fraction: 1.0,
            layerSetName: 'Single Material',
            count: 1
          }];
        }

        // Process elements in parallel using element volumes
        const elementVolumes = new Map<string, number>();
        for (const elementRef of relatedElements) {
          const elementId = this.stripHashFromId(elementRef);
          const element = this.entities.get(elementId);
          if (element) {
            elementVolumes.set(elementId, parseFloat(this.findElementVolume(element) || '0'));
          }
        }

        // Apply volumes to materials
        for (const [elementId, elementVolume] of elementVolumes) {
          const materialsWithVolume = materials.map(material => ({
            ...material,
            volume: material.fraction * elementVolume
          }));

          const existing = this.relationships.get(elementId) || { materials: [] };
          existing.materials = materialsWithVolume;
          this.relationships.set(elementId, existing);
        }
      }
    }

    console.log(`Processed ${spatialCount} spatial relationships and ${materialCount} material relationships`);
  }

  private processMaterialLayerSet(materialEntity: any): any[] {
    const layerSetRef = this.stripHashFromId(materialEntity.attributes[0]);
    const layerSet = this.entities.get(layerSetRef);

    if (!layerSet || layerSet.type !== 'IFCMATERIALLAYERSET') {
      return [];
    }

    const layers = this.parseList(layerSet.attributes[0]);
    let totalThickness = 0;
    const layerThicknesses: number[] = [];

    // First pass: calculate total thickness
    for (const layerRef of layers) {
      const layer = this.entities.get(this.stripHashFromId(layerRef));
      if (layer) {
        const thickness = parseFloat(layer.attributes[1] || '0.000');
        layerThicknesses.push(thickness);
        if (!isNaN(thickness) && thickness > 0) {
          totalThickness += thickness;
        }
      } else {
        layerThicknesses.push(0);
      }
    }

    // Second pass: create materials with fractions
    const materials = layers.map((layerRef, index) => {
      const layer = this.entities.get(this.stripHashFromId(layerRef));
      if (!layer) return null;

      const materialRef = layer.attributes[0];
      const material = this.entities.get(this.stripHashFromId(materialRef));

      if (!material || material.type !== 'IFCMATERIAL') return null;

      const materialName = this.removeQuotes(material.attributes[0] || 'Unknown Material');
      const thickness = layerThicknesses[index];
      const fraction = thickness <= 0 ? 0 : totalThickness > 0 ? thickness / totalThickness : 0;

      return {
        name: materialName,
        fraction,
        layerSetName: layerSet.attributes[0] || 'Unknown Layer Set',
        count: 1
      };
    }).filter(Boolean);

    // Normalize fractions if needed
    const totalFraction = materials.reduce((sum, m) => sum + m.fraction, 0);
    if (Math.abs(totalFraction) < 0.0001 && materials.length > 0) {
      const equalFraction = 1.0 / materials.length;
      materials.forEach(m => m.fraction = equalFraction);
    } else if (Math.abs(totalFraction - 1.0) > 0.0001 && totalFraction > 0) {
      materials.forEach(m => m.fraction = m.fraction / totalFraction);
    }

    return materials;
  }

  private removeQuotes(str: string): string {
    if (str.startsWith("'") && str.endsWith("'")) {
      return str.slice(1, -1);
    }
    return str;
  }

  private getBaseQuantityNames(elementType: string): string[] {
    return [
      `Qto_${elementType.toLowerCase()}BaseQuantities`,
      `Qto_${elementType}BaseQuantities`,
      `BaseQuantities`,
      `${elementType.toUpperCase()}BaseQuantities`,
      `Qto_${elementType}Quantities`
    ];
  }

  private checkQuantitySet(element: any, propertySet: any): string | null {
    if (propertySet.type !== 'IFCELEMENTQUANTITY') return null;

    const elementType = element.type.replace('Ifc', '');
    const baseNames = [
      `Qto_${elementType.toLowerCase()}BaseQuantities`,
      `Qto_${elementType}BaseQuantities`,
      `BaseQuantities`
    ];

    const setName = this.removeQuotes(propertySet.attributes[2] || '');
    if (!baseNames.some(name => setName.toLowerCase() === name.toLowerCase())) {
      return null;
    }

    const quantities = this.parseList(propertySet.attributes[5] || '');
    let netVolume = null;
    let grossVolume = null;

    for (const ref of quantities) {
      const quantity = this.entities.get(this.stripHashFromId(ref));
      if (!quantity || quantity.type !== 'IFCQUANTITYVOLUME') continue;

      const name = this.removeQuotes(quantity.attributes[0] || '');
      if (name === 'NetVolume') {
        netVolume = quantity.attributes[3];
      } else if (name === 'GrossVolume') {
        grossVolume = quantity.attributes[3];
      }
    }

    // Prefer NetVolume, fallback to GrossVolume
    if (netVolume !== null) {
      return netVolume;
    }
    if (grossVolume !== null) {
      return grossVolume;
    }

    return null;
  }

  private checkPropertySet(propertySet: any): string | null {
    if (propertySet.type !== 'IFCPROPERTYSET') return null;

    const psetName = this.removeQuotes(propertySet.attributes[2] || '');
    if (!psetName.includes('Quantity') && !psetName.includes('BaseQuantities')) {
      return null;
    }

    const properties = this.parseList(propertySet.attributes[4] || '');
    for (const ref of properties) {
      const property = this.entities.get(this.stripHashFromId(ref));
      if (!property || property.type !== 'IFCPROPERTYSINGLEVALUE') continue;

      const name = this.removeQuotes(property.attributes[0] || '');
      if (name.toLowerCase().includes('volume')) {
        return property.attributes[2];
      }
    }
    return null;
  }

  private findPropertyValue(entity: any, propertyName: string): string | null {
    // Find relationships pointing to this entity
    for (const [id, relEntity] of this.entities.entries()) {
      if (relEntity.type === 'IFCRELDEFINESBYPROPERTIES') {
        const relatedObjects = relEntity.attributes[4];
        if (!relatedObjects) continue;

        // Check if this entity is related
        const objectRefs = relatedObjects.split(',');
        const entityRef = `#${entity.id}`;
        if (!objectRefs.includes(entityRef)) continue;

        // Get property set reference
        const propertySetRef = relEntity.attributes[5];
        if (!propertySetRef) continue;

        const propertySet = this.entities.get(this.stripHashFromId(propertySetRef));
        if (!propertySet) continue;

        // Look for property
        const properties = propertySet.attributes[4];
        if (!properties) continue;

        const propertyRefs = properties.split(',');
        for (const ref of propertyRefs) {
          const property = this.entities.get(this.stripHashFromId(ref));
          if (!property) continue;

          // Check for property name
          if (property.type === 'IFCPROPERTYSINGLEVALUE' &&
            this.removeQuotes(property.attributes[0] || '') === propertyName) {
            const value = property.attributes[2];
            if (value) {
              return value;
            }
          }
        }
      }
    }

    return null;
  }

  private getUnitScale(): number {
    // Find IFCSIUNIT for length
    for (const entity of this.entities.values()) {
      if (entity.type === 'IFCSIUNIT') {
        const attributes = entity.attributes;
        // Check if it's a length unit
        if (attributes[2] === '.LENGTHUNIT.') {
          // Check for prefix
          const prefix = attributes[1];
          let scale: number;
          switch (prefix) {
            case '.MILLI.':
              scale = 0.001; // Convert millimeters to meters
              break;
            case '.CENTI.':
              scale = 0.01; // Convert centimeters to meters
              break;
            case '.DECI.':
              scale = 0.1; // Convert decimeters to meters
              break;
            case null:
            case '$':
            case undefined:
              scale = 1.0; // Already in meters
              break;
            default:
              console.warn(`Unknown length unit prefix: ${prefix}`);
              scale = 1.0;
          }
          return scale;
        }
      }
    }
    return 1.0; // Default to meters if no unit found
  }

  public extractElements(): IFCElementCollection {
    const elements: IFCElementCollection = {};
    const hasGeometry = new Set<string>();

    // First find all entities with geometry
    for (const entity of this.entities.values()) {
      if (entity.type === 'IFCPRODUCTDEFINITIONSHAPE') {
        const elementId = this.findElementForShape(entity.id);
        if (elementId) {
          const element = this.entities.get(elementId);
          if (element) {
            hasGeometry.add(elementId);
          }
        }
      }
    }

    // Process elements with geometry
    for (const elementId of hasGeometry) {
      const element = this.entities.get(elementId);
      const relationship = this.relationships.get(elementId);

      if (!elements[element.type]) {
        elements[element.type] = [];
      }

      const materialsList = relationship?.materials || [];
      const storey = relationship?.spatialStructure;

      // Get the building story name
      let buildingStory = 'Unknown Story';
      if (storey) {
        // Get the name from the storey entity's name attribute
        const storeyName = storey.attributes[2] || storey.attributes[1];
        if (storeyName) {
          buildingStory = storeyName;
          // Remove quotes if present
          if (buildingStory.startsWith("'") && buildingStory.endsWith("'")) {
            buildingStory = buildingStory.slice(1, -1);
          }
        }
      }

      // Get the element name
      let elementName = 'Unknown Element';
      if (element) {
        // Get the name from the element's name attribute
        const name = element.attributes[2] || element.attributes[1];
        if (name) {
          elementName = name;
          // Remove quotes if present
          if (elementName.startsWith("'") && elementName.endsWith("'")) {
            elementName = elementName.slice(1, -1);
          }
        }
      }

      const volume = this.findElementVolume(element);
      elements[element.type].push({
        id: elementId,
        type: element.type,
        name: elementName,
        buildingStory,
        materials: materialsList.map(m => ({
          name: m.name,
          fraction: m.fraction,
          volume: m.volume,
          layerSetName: m.layerSetName,
          count: m.count
        })),
        volume
      });
    }

    console.log('Element types found:', Object.keys(elements));
    for (const [type, list] of Object.entries(elements)) {
      console.log(`${type}: ${list.length} elements`);
    }

    return elements;
  }

  private findElementForShape(shapeId: string): string | null {
    for (const entity of this.entities.values()) {
      const attributes = entity.attributes;
      for (const attr of attributes) {
        if (attr === `#${shapeId}`) {
          return entity.id;
        }
      }
    }
    return null;
  }

  private parseContent() {
    const lines = this.content.split('\n');

    lines.forEach((line, index) => {
      try {
        if (line.includes('IFCWALL') || line.includes('IFCSLAB') || line.includes('IFCWINDOW')) {
          this.parseElement(line, index);
        }
      } catch (error) {
        console.error(`Error parsing line ${index}:`, error);
      }
    });
  }

  private parseElement(line: string, lineNumber: number) {
    const elementMatch = line.match(/#(\d+)=\s*(Ifc\w+)/);
    if (!elementMatch) return;

    const [, id, type] = elementMatch;

    const element: IFCExtractedElement = {
      id,
      type,
      name: this.extractName(line),
      materials: this.extractMaterials(line, lineNumber)
    };

    if (!this.elements[type]) {
      this.elements[type] = [];
    }
    this.elements[type].push(element);
  }

  private extractName(line: string): string | undefined {
    const nameMatch = line.match(/'([^']+)'/);
    return nameMatch ? nameMatch[1] : undefined;
  }

  private extractMaterials(line: string, lineNumber: number): IFCMaterial[] {
    const materials: IFCMaterial[] = [];

    // Extract material references
    const materialRefs = line.match(/#\d+/g) || [];

    materialRefs.forEach(ref => {
      const material = this.findMaterialByRef(ref);
      if (material) {
        materials.push(material);
      }
    });

    return materials;
  }

  private findMaterialByRef(ref: string): IFCMaterial | null {
    return this.materialIndex.get(ref) || null;
  }

  private extractVolume(line: string): number | undefined {
    const volumeMatch = line.match(/VOLUME\(([^)]+)\)/);
    if (volumeMatch) {
      const volume = parseFloat(volumeMatch[1]);
      return isNaN(volume) ? undefined : volume;
    }
    return undefined;
  }

  public extractElementsDirectly(): { [key: string]: IFCExtractedElement[] } {
    return this.elements;
  }
}