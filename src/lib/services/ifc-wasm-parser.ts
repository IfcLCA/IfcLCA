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
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
        script.async = true;
        script.onload = async () => {
          try {
            const pyodide: PyodideInterface = await (window as any).loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
            });
            await pyodide.loadPackage(['micropip', 'numpy']);
            const micropip = pyodide.pyimport('micropip');
            await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl');
            resolve(pyodide);
          } catch (e) {
            reject(e);
          }
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        const pyodide: PyodideInterface = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
        });
        await pyodide.loadPackage(['micropip', 'numpy']);
        const micropip = pyodide.pyimport('micropip');
        await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl');
        resolve(pyodide);
      }
    } catch (err) {
      reject(err);
    }
  });
  return pyodideLoading;
}

export async function parseIfcWithWasm(file: File): Promise<APIElement[]> {
  const pyodide = await loadPyodideAndIfcOpenShell();
  const buffer = new Uint8Array(await file.arrayBuffer());
  pyodide.globals.set('ifc_data', buffer);

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

ifc_bytes = bytes(ifc_data.to_py())
path = '/tmp/temp.ifc'
with open(path, 'wb') as f:
    f.write(ifc_bytes)

f = ifcopenshell.open(path)

elements = []
for e in f.by_type('IfcBuildingElement'):
    elements.append({
        'id': e.GlobalId,
        'type': e.is_a(),
        'object_type': get_object_type(e),
        'properties': get_properties(e),
        'volume': get_volume(e),
        'materials': get_materials(e)
    })

try:
    os.remove(path)
except Exception:
    pass

json.dumps(elements)
`;

  const result = await pyodide.runPythonAsync(pythonCode);
  return JSON.parse(result);
}
