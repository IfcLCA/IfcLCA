export interface APIElement {
  id: string;
  type: string;
  object_type: string;
  properties: {
    name?: string;
    level?: string;
    loadBearing?: boolean;
    isExternal?: boolean;
  };
  volume?: number;
  area?: number;
  materials?: string[];
  material_volumes?: {
    [key: string]: {
      volume: number;
      fraction: number;
    };
  };
}

export interface IFCParseResult {
  elements: APIElement[];
  debug: Array<{
    id: string;
    type: string;
    has_associations: boolean;
    materials_found: number;
    material_volumes_found: number;
    materials: string[];
    material_volumes: { [key: string]: { volume: number; fraction: number } };
    material_type?: string;
    constituent_count?: number;
    layer_count?: number;
    layer_set_type?: string;
  }>;
  total_elements: number;
  total_materials_found: number;
  total_material_volumes_found: number;
}

interface PyodideInterface {
  loadPackage: (packages: string[]) => Promise<void>;
  pyimport: (name: string) => any;
  globals: { set: (name: string, value: unknown) => void };
  runPythonAsync: (code: string) => Promise<string>;
}

let pyodideLoading: Promise<PyodideInterface> | null = null;

async function loadPyodideAndIfcOpenShell(): Promise<PyodideInterface> {
  if (pyodideLoading) return pyodideLoading;
  pyodideLoading = new Promise(async (resolve, reject) => {
    try {
      if (!(window as any).loadPyodide) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        script.async = true;
        script.onload = async () => {
          try {
            const pyodide: PyodideInterface = await (window as any).loadPyodide(
              {
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
              }
            );
            await pyodide.loadPackage(["micropip", "numpy"]);
            const micropip = pyodide.pyimport("micropip");
            await micropip.install(
              "https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl"
            );
            resolve(pyodide);
          } catch (e) {
            reject(e);
          }
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        const pyodide: PyodideInterface = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
        });
        await pyodide.loadPackage(["micropip", "numpy"]);
        const micropip = pyodide.pyimport("micropip");
        await micropip.install(
          "https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl"
        );
        resolve(pyodide);
      }
    } catch (err) {
      reject(err);
    }
  });
  return pyodideLoading;
}

export async function parseIfcWithWasm(file: File): Promise<IFCParseResult> {
  const pyodide = await loadPyodideAndIfcOpenShell();
  const buffer = new Uint8Array(await file.arrayBuffer());
  pyodide.globals.set("ifc_data", buffer);

  const pythonCode = `
import ifcopenshell
import json
import os

# helper functions

def get_object_type(element):
    if getattr(element, 'ObjectType', None):
        return element.ObjectType
    if getattr(element, 'IsTypedBy', None):
        for rel in element.IsTypedBy:
            if getattr(rel, 'RelatingType', None) and getattr(rel.RelatingType, 'Name', None):
                return rel.RelatingType.Name
    if getattr(element, 'Name', None):
        return element.Name
    return element.is_a()

def get_properties(element):
    props = {}
    if getattr(element, 'Name', None):
        props['name'] = element.Name
    if getattr(element, 'IsDefinedBy', None):
        for rel in element.IsDefinedBy:
            if rel.is_a('IfcRelDefinesByProperties'):
                pdef = rel.RelatingPropertyDefinition
                if pdef.is_a('IfcPropertySet'):
                    for prop in pdef.HasProperties:
                        if prop.is_a('IfcPropertySingleValue') and prop.NominalValue:
                            if prop.Name.lower() == 'loadbearing':
                                props['loadBearing'] = bool(prop.NominalValue.wrappedValue)
                            if prop.Name.lower() == 'isexternal':
                                props['isExternal'] = bool(prop.NominalValue.wrappedValue)
    return props

def get_volume(element):
    if getattr(element, 'IsDefinedBy', None):
        for rel in element.IsDefinedBy:
            if rel.is_a('IfcRelDefinesByProperties'):
                pdef = rel.RelatingPropertyDefinition
                if pdef.is_a('IfcElementQuantity'):
                    for qty in pdef.Quantities:
                        if qty.is_a('IfcQuantityVolume'):
                            return float(qty.VolumeValue)
    return None

def get_materials(element):
    mats = []
    if getattr(element, 'HasAssociations', None):
        for rel in element.HasAssociations:
            if rel.is_a('IfcRelAssociatesMaterial'):
                mat = rel.RelatingMaterial
                if mat.is_a('IfcMaterial') and mat.Name:
                    mats.append(mat.Name)
                elif mat.is_a('IfcMaterialLayerSet'):
                    for layer in mat.MaterialLayers:
                        if layer.Material and layer.Material.Name:
                            mats.append(layer.Material.Name)
                elif mat.is_a('IfcMaterialConstituentSet'):
                    for c in mat.MaterialConstituents:
                        if c.Material and c.Material.Name:
                            mats.append(c.Material.Name)
    return list(set(mats))

def get_material_volumes(element):
    material_volumes = {}
    element_volume = get_volume(element) or 0
    
    if getattr(element, 'HasAssociations', None):
        for rel in element.HasAssociations:
            if rel.is_a('IfcRelAssociatesMaterial'):
                mat = rel.RelatingMaterial
                
                # Handle IfcMaterialConstituentSet (preferred method)
                if mat.is_a('IfcMaterialConstituentSet'):
                    total_fraction = 0.0
                    constituent_fractions = {}
                    
                    # First pass: collect all fractions
                    for constituent in mat.MaterialConstituents:
                        if constituent.Material and constituent.Material.Name:
                            fraction = getattr(constituent, 'Fraction', None)
                            if fraction is not None:
                                constituent_fractions[constituent.Material.Name] = float(fraction)
                                total_fraction += float(fraction)
                            else:
                                # If no fraction specified, assume equal distribution
                                constituent_fractions[constituent.Material.Name] = 1.0 / len(mat.MaterialConstituents)
                                total_fraction += 1.0 / len(mat.MaterialConstituents)
                    
                    # Normalize fractions if they don't sum to 1
                    if total_fraction > 0:
                        for material_name, fraction in constituent_fractions.items():
                            normalized_fraction = fraction / total_fraction if total_fraction != 1.0 else fraction
                            material_volumes[material_name] = {
                                'volume': element_volume * normalized_fraction,
                                'fraction': normalized_fraction
                            }
                
                # Handle IfcMaterialLayerSet (fallback method)
                elif mat.is_a('IfcMaterialLayerSet'):
                    total_thickness = 0.0
                    layer_thicknesses = {}
                    
                    # First pass: collect all thicknesses
                    for layer in mat.MaterialLayers:
                        if layer.Material and layer.Material.Name and hasattr(layer, 'LayerThickness') and layer.LayerThickness:
                            thickness = float(layer.LayerThickness)
                            layer_thicknesses[layer.Material.Name] = thickness
                            total_thickness += thickness
                    
                    # Calculate volume fractions based on thickness
                    if total_thickness > 0:
                        for material_name, thickness in layer_thicknesses.items():
                            fraction = thickness / total_thickness
                            material_volumes[material_name] = {
                                'volume': element_volume * fraction,
                                'fraction': fraction
                            }
                    else:
                        # Equal distribution if no thickness data
                        num_layers = len([l for l in mat.MaterialLayers if l.Material and l.Material.Name])
                        if num_layers > 0:
                            fraction = 1.0 / num_layers
                            for layer in mat.MaterialLayers:
                                if layer.Material and layer.Material.Name:
                                    material_volumes[layer.Material.Name] = {
                                        'volume': element_volume * fraction,
                                        'fraction': fraction
                                    }
                
                # Handle IfcMaterialLayerSetUsage
                elif mat.is_a('IfcMaterialLayerSetUsage'):
                    layer_set = getattr(mat, 'ForLayerSet', None)
                    if layer_set and layer_set.is_a('IfcMaterialLayerSet'):
                        # Process the underlying layer set
                        total_thickness = 0.0
                        layer_thicknesses = {}
                        
                        for layer in layer_set.MaterialLayers:
                            if layer.Material and layer.Material.Name and hasattr(layer, 'LayerThickness') and layer.LayerThickness:
                                thickness = float(layer.LayerThickness)
                                layer_thicknesses[layer.Material.Name] = thickness
                                total_thickness += thickness
                        
                        if total_thickness > 0:
                            for material_name, thickness in layer_thicknesses.items():
                                fraction = thickness / total_thickness
                                material_volumes[material_name] = {
                                    'volume': element_volume * fraction,
                                    'fraction': fraction
                                }
                
                # Handle single IfcMaterial (simple case)
                elif mat.is_a('IfcMaterial') and mat.Name:
                    material_volumes[mat.Name] = {
                        'volume': element_volume,
                        'fraction': 1.0
                    }
    
    return material_volumes

ifc_bytes = bytes(ifc_data.to_py())
path = '/tmp/temp.ifc'
with open(path, 'wb') as f:
    f.write(ifc_bytes)

f = ifcopenshell.open(path)

elements = []
debug_info = []

for e in f.by_type('IfcBuildingElement'):
    element_materials = get_materials(e)
    element_material_volumes = get_material_volumes(e)
    
    # Debug info for this element
    element_debug = {
        'id': e.GlobalId,
        'type': e.is_a(),
        'has_associations': bool(getattr(e, 'HasAssociations', None)),
        'materials_found': len(element_materials),
        'material_volumes_found': len(element_material_volumes),
        'materials': element_materials,
        'material_volumes': element_material_volumes
    }
    
    # Check material associations for debugging
    if getattr(e, 'HasAssociations', None):
        for rel in e.HasAssociations:
            if rel.is_a('IfcRelAssociatesMaterial'):
                mat = rel.RelatingMaterial
                element_debug['material_type'] = mat.is_a()
                if mat.is_a('IfcMaterialConstituentSet'):
                    element_debug['constituent_count'] = len(mat.MaterialConstituents) if mat.MaterialConstituents else 0
                elif mat.is_a('IfcMaterialLayerSet'):
                    element_debug['layer_count'] = len(mat.MaterialLayers) if mat.MaterialLayers else 0
                elif mat.is_a('IfcMaterialLayerSetUsage'):
                    layer_set = getattr(mat, 'ForLayerSet', None)
                    if layer_set:
                        element_debug['layer_set_type'] = layer_set.is_a()
                        element_debug['layer_count'] = len(layer_set.MaterialLayers) if layer_set.MaterialLayers else 0
    
    debug_info.append(element_debug)
    
    elements.append({
        'id': e.GlobalId,
        'type': e.is_a(),
        'object_type': get_object_type(e),
        'properties': get_properties(e),
        'volume': get_volume(e),
        'materials': element_materials,
        'material_volumes': element_material_volumes
    })

# Include debug info in the result
result = {
    'elements': elements,
    'debug': debug_info,
    'total_elements': len(elements),
    'total_materials_found': sum(len(e['materials']) for e in elements),
    'total_material_volumes_found': sum(len(e['material_volumes']) for e in elements)
}

try:
    os.remove(path)
except Exception:
    pass

json.dumps(result)
`;

  const result = await pyodide.runPythonAsync(pythonCode);
  return JSON.parse(result);
}
