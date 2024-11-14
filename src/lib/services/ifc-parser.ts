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
    const dataSectionMatch = content.match(/DATA;([\s\S]*?)ENDSEC;/);
    if (!dataSectionMatch) {
      throw new Error("Invalid IFC file: DATA section not found");
    }
    const dataSection = dataSectionMatch[1].trim();

    dataSection.split("\n").forEach((line) => {
      if (line.trim()) {
        this._parseLine(line.trim());
      }
    });

    this._processRelationships();
    this._collectNetVolumes();
    this._collectMaterialLayers();
    this._processElements();

    return this.elements;
  }

  private _parseLine(line: string) {
    line = line.endsWith(";") ? line.slice(0, -1) : line;
    const [idPart, content] = line.split("=", 2);
    if (!idPart || !content) {
      return;
    }

    const entityId = idPart.trim().slice(1);
    const [entityType, attributes] = this._parseEntity(content.trim());

    this.entities[entityId] = {
      type: entityType,
      attributes: attributes,
    };
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
                  if (materialEntity && materialEntity.attributes[0]) {
                    materialName = materialEntity.attributes[0];
                  }
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

          this.materialLayers[id] = {
            layerSetName,
            layers,
          };
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

        this.elements.push({
          id,
          globalId,
          type: entity.type,
          name,
          spatialContainer,
          materials,
          netVolume,
          materialLayers,
        });
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
      return { materials: ["Unknown"], materialLayers: null };
    }

    const index = parseInt(materialRef.ref, 10);
    if (isNaN(index)) {
      return { materials: ["Unknown"], materialLayers: null };
    }

    const materials: string[] = [];
    const queue = [materialRef];
    const visited = new Set();

    // Track if we're dealing with a direct material assignment
    let isDirectAssignment = false;
    let materialLayers = null;

    while (queue.length > 0) {
      const currentRef = queue.shift();
      if (!currentRef || !currentRef.ref || visited.has(currentRef.ref))
        continue;

      visited.add(currentRef.ref);
      const entity = this.entities[currentRef.ref];

      if (!entity) continue;

      switch (entity.type) {
        case "IFCMATERIAL":
          const materialName = entity.attributes[0] || "Unnamed Material";
          materials.push(currentRef.ref);
          isDirectAssignment = true;
          break;

        case "IFCMATERIALLAYERSET":
          const layers = entity.attributes[0];
          if (Array.isArray(layers)) {
            layers.forEach((layerRef) => {
              if (layerRef && layerRef.ref) {
                queue.push(layerRef);
              }
            });
          }
          break;

        case "IFCMATERIALLAYERSETUSAGE":
          const layerSetRef = entity.attributes[0];
          if (layerSetRef && layerSetRef.ref) {
            materialLayers = this.materialLayers[layerSetRef.ref];
          }
          break;

        case "IFCMATERIALCONSTITUENTSET":
          const constituents = entity.attributes[2];
          if (Array.isArray(constituents)) {
            constituents.forEach((constituentRef) => {
              if (constituentRef && constituentRef.ref) {
                queue.push(constituentRef);
              }
            });
          }
          break;

        case "IFCMATERIALLIST":
          const materialsList = entity.attributes[0];
          if (Array.isArray(materialsList)) {
            materialsList.forEach((materialRef) => {
              if (materialRef && materialRef.ref) {
                queue.push(materialRef);
              }
            });
          }
          break;

        case "IFCMATERIALLAYER":
        case "IFCMATERIALCONSTITUENT":
          if (entity.attributes[2] && entity.attributes[2].ref) {
            queue.push(entity.attributes[2]);
          }
          break;
      }
    }

    // If we have direct material assignments but no layers, create a synthetic layer structure
    if (isDirectAssignment && !materialLayers) {
      materialLayers = {
        layerSetName: "Direct Assignment",
        layers: materials.map((materialRef) => {
          const material = this.entities[materialRef];
          return {
            layerId: materialRef,
            materialName: material?.attributes[0] || "Unknown",
            thickness: 1, // Default thickness for direct assignments
            layerName: material?.attributes[0] || "Unknown",
          };
        }),
      };
    }

    return { materials, materialLayers };
  }
}
