interface IFCEntity {
  type: string;
  attributes: any[];
}

interface IFCRelationship {
  spatialContainer?: { ref: string };
  material?: { ref: string };
  propertySets?: { ref: string }[];
}

interface IFCLayer {
  ref: string;
}

export class IFCParser {
  private entities: Record<string, IFCEntity>;
  private elements: any[];
  private relationships: Record<string, IFCRelationship>;
  private quantities: Record<string, number>;
  private materialLayers: Record<string, any>;

  constructor() {
    this.entities = {};
    this.elements = [];
    this.relationships = {};
    this.quantities = {};
    this.materialLayers = {};
  }

  parseContent(content: string) {
    console.log(' [IFCParser] Starting to parse Ifc content...');
    const dataSectionMatch = content.match(/DATA;([\s\S]*?)ENDSEC;/);
    if (!dataSectionMatch) {
      console.error(' [IFCParser] Invalid Ifc file: DATA section not found');
      throw new Error("Invalid Ifc file: DATA section not found");
    }
    const dataSection = dataSectionMatch[1].trim();
    console.log(' [IFCParser] Found DATA section');

    let lineCount = 0;
    dataSection.split("\n").forEach((line) => {
      if (line.trim()) {
        this._parseLine(line.trim());
        lineCount++;
      }
    });
    console.log(` [IFCParser] Parsed ${lineCount} lines`);

    console.log(' [IFCParser] Processing relationships...');
    this._processRelationships();
    
    console.log(' [IFCParser] Collecting net volumes...');
    this._collectNetVolumes();
    
    console.log(' [IFCParser] Collecting material layers...');
    this._collectMaterialLayers();
    
    console.log(' [IFCParser] Processing elements...');
    this._processElements();

    console.log(` [IFCParser] Parsing complete. Found:`, {
      entityCount: Object.keys(this.entities).length,
      elementCount: this.elements.length,
      relationshipCount: Object.keys(this.relationships).length,
      quantityCount: Object.keys(this.quantities).length,
      materialLayerCount: Object.keys(this.materialLayers).length
    });

    return this.elements;
  }

  private _parseLine(line: string) {
    line = line.endsWith(";") ? line.slice(0, -1) : line;
    const [idPart, content] = line.split("=", 2);
    if (!idPart || !content) {
      console.warn(' [IFCParser] Invalid line format:', line);
      return;
    }

    const entityId = idPart.trim().slice(1);
    const [entityType, attributes] = this._parseEntity(content.trim());

    this.entities[entityId] = {
      type: entityType,
      attributes: attributes,
    };

    if (entityType === 'IFCRELDEFINESBYPROPERTIES' || 
        entityType === 'IFCRELCONTAINEDINSPATIALSTRUCTURE' ||
        entityType === 'IFCRELASSOCIATESMATERIAL') {
      console.log(` [IFCParser] Found relationship: ${entityType} (#${entityId})`);
    }
  }

  private _parseEntity(content: string): [string, any[]] {
    const entityType = content.substring(0, content.indexOf("(")).trim();
    const attributesStr = content.substring(
      content.indexOf("(") + 1,
      content.lastIndexOf(")")
    );
    const attributes = this._parseAttributes(attributesStr);
    return [entityType, attributes];
  }

  private _parseAttributes(attributesStr: string): any[] {
    const attributes = [];
    let currentAttr = "";
    let nestLevel = 0;
    let inString = false;

    for (let i = 0; i < attributesStr.length; i++) {
      const char = attributesStr[i];
      if (char === "'" && attributesStr[i - 1] !== "\\") {
        inString = !inString;
      } else if (!inString) {
        if (char === "(") nestLevel++;
        if (char === ")") nestLevel--;
        if (char === "," && nestLevel === 0) {
          attributes.push(this._cleanAttribute(currentAttr));
          currentAttr = "";
          continue;
        }
      }
      currentAttr += char;
    }

    if (currentAttr) {
      attributes.push(this._cleanAttribute(currentAttr));
    }

    return attributes;
  }

  private _cleanAttribute(attr: string): any {
    attr = attr.trim();
    if (attr === "$" || attr === "*") return null;
    if (attr.startsWith("'") && attr.endsWith("'")) return attr.slice(1, -1);
    if (attr.startsWith("#")) return { ref: attr.slice(1) };
    if (!isNaN(attr))
      return attr.includes(".") ? parseFloat(attr) : parseInt(attr, 10);
    if (attr.startsWith("(") && attr.endsWith(")"))
      return this._parseAttributes(attr.slice(1, -1));
    if (attr.startsWith(".") && attr.endsWith(".")) return attr.slice(1, -1);
    return attr;
  }

  private _processRelationships() {
    Object.entries(this.entities).forEach(([id, entity]) => {
      if (entity.type === "IFCRELCONTAINEDINSPATIALSTRUCTURE") {
        const relatedElements = entity.attributes[4];
        const relatingStructure = entity.attributes[5];
        if (Array.isArray(relatedElements)) {
          relatedElements.forEach((element) => {
            if (element && element.ref) {
              this.relationships[element.ref] = {
                ...this.relationships[element.ref],
                spatialContainer: relatingStructure,
              };
            }
          });
        }
      } else if (entity.type === "IFCRELASSOCIATESMATERIAL") {
        const relatedObjects = entity.attributes[4];
        const relatingMaterial = entity.attributes[5];
        if (Array.isArray(relatedObjects)) {
          relatedObjects.forEach((object) => {
            if (object && object.ref) {
              this.relationships[object.ref] = {
                ...this.relationships[object.ref],
                material: relatingMaterial,
              };
            }
          });
        }
      } else if (entity.type === "IFCRELDEFINESBYPROPERTIES") {
        const relatedObjects = entity.attributes[4];
        const relatingPropertyDefinition = entity.attributes[5];
        if (Array.isArray(relatedObjects)) {
          relatedObjects.forEach((object) => {
            if (object && object.ref) {
              this.relationships[object.ref] = {
                ...this.relationships[object.ref],
                propertySets: this.relationships[object.ref]?.propertySets
                  ? [
                      ...this.relationships[object.ref].propertySets,
                      relatingPropertyDefinition,
                    ]
                  : [relatingPropertyDefinition],
              };
            }
          });
        }
      }
    });
  }

  private _collectNetVolumes() {
    Object.entries(this.entities).forEach(([id, entity]) => {
      if (entity.type === "IFCRELDEFINESBYPROPERTIES") {
        const relatedObjects = entity.attributes[4];
        const relatingPropertyDefinition = entity.attributes[5];

        if (relatingPropertyDefinition && relatingPropertyDefinition.ref) {
          const propDefEntity = this.entities[relatingPropertyDefinition.ref];
          if (propDefEntity && propDefEntity.type === "IFCELEMENTQUANTITY") {
            const quantities = propDefEntity.attributes[5];
            if (Array.isArray(quantities)) {
              quantities.forEach((quantityRef) => {
                if (quantityRef && quantityRef.ref) {
                  const quantityEntity = this.entities[quantityRef.ref];
                  if (
                    quantityEntity &&
                    quantityEntity.type === "IFCQUANTITYVOLUME"
                  ) {
                    const quantityName = quantityEntity.attributes[0];
                    if (quantityName === "NetVolume") {
                      const volumeValue = quantityEntity.attributes[3];
                      if (Array.isArray(relatedObjects)) {
                        relatedObjects.forEach((object) => {
                          if (object && object.ref) {
                            this.quantities[object.ref] = volumeValue;
                          }
                        });
                      }
                    }
                  }
                }
              });
            }
          }
        }
      }
    });
  }

  private _findElementForQuantity(quantityId: string): string | null {
    for (const [relId, relationship] of Object.entries(this.entities)) {
      if (
        relationship.type === "IFCRELDEFINESBYPROPERTIES" &&
        relationship.attributes[5]?.ref === quantityId
      ) {
        const relatedObjects = relationship.attributes[4];
        if (Array.isArray(relatedObjects) && relatedObjects[0]?.ref) {
          return relatedObjects[0].ref;
        }
      }
    }
    return null;
  }

  private _collectMaterialLayers() {
    Object.entries(this.entities).forEach(([id, entity]) => {
      if (entity.type === "IFCMATERIALLAYERSET") {
        const materialLayerRefs = entity.attributes[0];
        const layerSetName = entity.attributes[1] || `Unnamed LayerSet ${id}`;

        if (Array.isArray(materialLayerRefs)) {
          const layers = [];
          materialLayerRefs.forEach((layerRef) => {
            if (layerRef && layerRef.ref) {
              const layerEntity = this.entities[layerRef.ref];
              if (layerEntity && layerEntity.type === "IFCMATERIALLAYER") {
                const materialRef = layerEntity.attributes[0];
                const thickness = layerEntity.attributes[1];
                const layerName = layerEntity.attributes[3];
                let materialName = "Unknown Material";

                if (materialRef && materialRef.ref) {
                  const materialEntity = this.entities[materialRef.ref];
                  if (materialEntity) {
                    if (materialEntity.type === "IFCMATERIAL" && materialEntity.attributes[0]) {
                      materialName = materialEntity.attributes[0];
                      console.log(` [IFCParser] Found material in layer:`, {
                        layerSetId: id,
                        layerId: layerRef.ref,
                        materialId: materialRef.ref,
                        materialName,
                        materialType: materialEntity.type,
                        thickness
                      });
                    } else {
                      console.log(` [IFCParser] Invalid material entity:`, {
                        layerSetId: id,
                        layerId: layerRef.ref,
                        materialId: materialRef.ref,
                        materialType: materialEntity.type,
                        attributes: materialEntity.attributes
                      });
                    }
                  }
                } else {
                  console.log(` [IFCParser] Layer missing material reference:`, {
                    layerSetId: id,
                    layerId: layerRef.ref,
                    layerName
                  });
                }

                layers.push({
                  layerId: layerRef.ref,
                  layerName,
                  thickness,
                  materialName,
                });
              }
            }
          });

          if (layers.length > 0) {
            console.log(` [IFCParser] Found material layer set #${id}:`, {
              layerSetName,
              layerCount: layers.length,
              layers: layers.map(l => ({
                materialName: l.materialName,
                thickness: l.thickness,
                layerName: l.layerName
              }))
            });
            this.materialLayers[id] = {
              layerSetName,
              layers,
            };
          } else {
            console.log(` [IFCParser] Empty material layer set #${id}`);
          }
        }
      }
    });
  }

  private _processElements() {
    Object.entries(this.entities).forEach(([id, entity]) => {
      if (
        [
          "IFCWALL",
          "IFCSLAB",
          "IFCBEAM",
          "IFCCOLUMN",
          "IFCFOOTING",
          "IFCPILE",
          "IFCROOF",
          "IFCSTAIR",
          "IFCRAMP",
          "IFCPLATE",
          "IFCMEMBER",
          "IFCBUILDINGELEMENTPROXY",
          "IFCCURTAINWALL",
        ].includes(entity.type)
      ) {
        const globalId = entity.attributes[0] || `No GlobalId`;
        const name = entity.attributes[2] || `Unnamed ${entity.type}`;
        const relationships = this.relationships[id] || {};
        const spatialContainer = this._getEntityName(
          relationships.spatialContainer
        );
        const { materials, materialLayers } = this._getMaterialInfo(
          relationships.material,
          id
        );
        const netVolume = this.quantities[id] || "Unknown";

        const element = {
          id,
          globalId,
          type: entity.type,
          name,
          spatialContainer,
          materials,
          netVolume,
          materialLayers,
        };

        if (materialLayers?.layers?.length > 0) {
          console.log(` [IFCParser] Processed element #${id}:`, {
            type: element.type,
            materialCount: element.materialLayers.layers.length,
            materials: element.materialLayers.layers.map(l => ({
              name: l.materialName,
              thickness: l.thickness
            }))
          });
        }
        this.elements.push(element);
      }
    });
  }

  private _getEntityName(ref: { ref: string } | undefined): string {
    if (ref && ref.ref && this.entities[ref.ref]) {
      return this.entities[ref.ref].attributes[2] || "Unnamed";
    }
    return "Unknown";
  }

  private _getMaterialInfo(
    materialRef: { ref: string } | undefined,
    elementId: string
  ): { materials: string[]; materialLayers: any } {
    if (!materialRef?.ref) {
      console.log(` [IFCParser] No material reference for element #${elementId}`);
      return { materials: ["Unknown"], materialLayers: null };
    }

    const materialEntity = this.entities[materialRef.ref];
    if (!materialEntity) {
      console.log(` [IFCParser] Invalid material reference for element #${elementId}:`, materialRef.ref);
      return { materials: ["Unknown"], materialLayers: null };
    }

    if (materialEntity.type === "IFCMATERIAL") {
      const materialName = materialEntity.attributes[0] || "Unnamed Material";
      console.log(` [IFCParser] Found single material for element #${elementId}:`, materialName);
      return { materials: [materialName], materialLayers: null };
    }

    if (materialEntity.type === "IFCMATERIALLAYERSET") {
      return {
        materials: [],
        materialLayers: this.materialLayers[materialRef.ref] || null
      };
    }

    if (materialEntity.type === "IFCMATERIALLAYERSETUSAGE") {
      // Get the reference to the material layer set
      const layerSetRef = materialEntity.attributes[0];
      if (layerSetRef && layerSetRef.ref) {
        const layerSet = this.entities[layerSetRef.ref];
        if (layerSet && layerSet.type === "IFCMATERIALLAYERSET") {
          console.log(` [IFCParser] Found material layer set usage for element #${elementId}:`, {
            layerSetRef: layerSetRef.ref,
            layerSet: this.materialLayers[layerSetRef.ref]
          });
          return {
            materials: [],
            materialLayers: this.materialLayers[layerSetRef.ref] || null
          };
        }
      }
      console.log(` [IFCParser] Invalid layer set reference in usage for element #${elementId}`);
      return { materials: ["Unknown"], materialLayers: null };
    }

    if (materialEntity.type === "IFCMATERIALLIST") {
      const materialRefs = materialEntity.attributes[0] || [];
      const materials = materialRefs
        .map((ref: { ref: string }) => {
          if (ref && ref.ref) {
            const mat = this.entities[ref.ref];
            return mat && mat.attributes[0] ? mat.attributes[0] : null;
          }
          return null;
        })
        .filter((name: string | null) => name !== null);

      console.log(` [IFCParser] Found material list for element #${elementId}:`, materials);
      return { materials: materials.length ? materials : ["Unknown"], materialLayers: null };
    }

    console.log(` [IFCParser] Unhandled material type for element #${elementId}:`, materialEntity.type);
    return { materials: ["Unknown"], materialLayers: null };
  }
}
