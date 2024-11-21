import { Transform, TransformCallback } from 'stream';
import { EventEmitter } from 'events';

interface IFCStreamParserOptions {
  batchSize?: number;
  maxBufferSize?: number;
}

interface IFCEntity {
  id: string;
  type: string;
  attributes: string[];
}

export class IFCStreamParser extends Transform {
  private buffer: string = '';
  private lineBuffer: string[] = [];
  private entities: Map<string, any> = new Map();
  private readonly batchSize: number;
  private readonly maxBufferSize: number;
  private state = {
    inHeader: false,
    inDataSection: false,
    currentLine: 0
  };

  constructor(options: IFCStreamParserOptions = {}) {
    super({ objectMode: true });
    this.batchSize = options.batchSize || 1000;
    this.maxBufferSize = options.maxBufferSize || 5 * 1024 * 1024; // 5MB default
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback): void {
    try {
      // Add new data to buffer
      this.buffer += chunk.toString();

      // Process complete lines if buffer gets too large
      if (this.buffer.length > this.maxBufferSize) {
        this.processBufferedLines();
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      // Process any remaining data
      this.processBufferedLines();
      
      // Process any remaining lines in lineBuffer
      if (this.lineBuffer.length > 0) {
        this.processLines(this.lineBuffer);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  private processBufferedLines(): void {
    // Split buffer into lines
    const lines = this.buffer.split('\n');
    
    // Keep last partial line in buffer
    this.buffer = lines.pop() || '';

    // Add complete lines to lineBuffer
    this.lineBuffer.push(...lines);

    // Process in batches if we have enough lines
    while (this.lineBuffer.length >= this.batchSize) {
      const batch = this.lineBuffer.splice(0, this.batchSize);
      this.processLines(batch);
    }
  }

  private processLines(lines: string[]): void {
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;

      // Handle file sections
      if (trimmedLine === 'ISO-10303-21;') {
        this.state.inHeader = true;
        continue;
      } else if (trimmedLine === 'HEADER;') {
        this.state.inHeader = true;
        continue;
      } else if (trimmedLine === 'ENDSEC;') {
        this.state.inHeader = false;
        this.state.inDataSection = false;
        continue;
      } else if (trimmedLine === 'DATA;') {
        this.state.inDataSection = true;
        continue;
      }

      // Only parse entity definitions in the data section
      if (!this.state.inDataSection) continue;

      const entity = this.parseLine(trimmedLine);
      if (entity) {
        this.push(entity);
      }
    }
  }

  private parseLine(line: string): IFCEntity | null {
    const match = line.match(/^#(\d+)=\s*(\w+)\((.*)\);?$/);
    if (!match) return null;

    const [, id, type, attributesStr] = match;
    const attributes = this.parseList(attributesStr);

    return { id, type, attributes };
  }

  private parseList(list: string): string[] {
    if (!list) return [];
    
    const result = [];
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
}

export class IFCStreamProcessor extends EventEmitter {
  private parser: IFCStreamParser;
  private materialRelationships: Map<string, any> = new Map();
  private spatialRelationships: Map<string, any> = new Map();
  private elements: Map<string, any> = new Map();
  private materials: Map<string, any> = new Map();

  constructor(options: IFCStreamParserOptions = {}) {
    super();
    this.parser = new IFCStreamParser(options);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.parser.on('data', (entity: IFCEntity) => {
      this.processEntity(entity);
    });

    this.parser.on('end', () => {
      this.finalizeProcessing();
    });

    this.parser.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private processEntity(entity: IFCEntity) {
    switch (entity.type) {
      case 'IFCWALL':
      case 'IFCSLAB':
      case 'IFCWINDOW':
        this.processElement(entity);
        break;
      case 'IFCRELASSOCIATESMATERIAL':
        this.processMaterialRelationship(entity);
        break;
      case 'IFCRELCONTAINEDINSPATIALSTRUCTURE':
        this.processSpatialRelationship(entity);
        break;
    }
  }

  private processElement(entity: IFCEntity) {
    const element = {
      id: entity.id,
      type: entity.type,
      name: this.extractName(entity.attributes),
      volume: 0,
      materials: []
    };
    this.elements.set(entity.id, element);
    this.emit('element', element);
  }

  private processMaterialRelationship(entity: IFCEntity) {
    const relatedElements = this.parseList(entity.attributes[4]);
    const materialRef = this.stripHashFromId(entity.attributes[5]);

    relatedElements.forEach(elementRef => {
      const elementId = this.stripHashFromId(elementRef);
      const existing = this.materialRelationships.get(elementId) || { materials: [] };
      existing.materials.push(materialRef);
      this.materialRelationships.set(elementId, existing);
    });
  }

  private processSpatialRelationship(entity: IFCEntity) {
    const relatedElements = this.parseList(entity.attributes[4]);
    const spatialRef = this.stripHashFromId(entity.attributes[5]);

    relatedElements.forEach(elementRef => {
      const elementId = this.stripHashFromId(elementRef);
      this.spatialRelationships.set(elementId, spatialRef);
    });
  }

  private finalizeProcessing() {
    // Process material relationships
    for (const [elementId, relationships] of this.materialRelationships) {
      const element = this.elements.get(elementId);
      if (element) {
        element.materials = relationships.materials.map(materialRef => {
          const material = this.materials.get(materialRef);
          return material || { name: 'Unknown', volume: 0 };
        });
      }
    }

    // Process spatial relationships
    for (const [elementId, spatialRef] of this.spatialRelationships) {
      const element = this.elements.get(elementId);
      if (element) {
        element.spatialContainer = spatialRef;
      }
    }

    this.emit('end', {
      elements: Array.from(this.elements.values()),
      materials: Array.from(this.materials.values())
    });
  }

  private extractName(attributes: string[]): string {
    const name = attributes[2] || attributes[1];
    if (name && name.startsWith("'") && name.endsWith("'")) {
      return name.slice(1, -1);
    }
    return name || '';
  }

  private stripHashFromId(id: string): string {
    return id.startsWith('#') ? id.substring(1) : id;
  }

  private parseList(list: string): string[] {
    return list.split(',').map(item => item.trim());
  }

  process(content: string | Buffer) {
    this.parser.write(content);
    this.parser.end();
  }
}
