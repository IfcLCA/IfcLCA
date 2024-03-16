import sys
import ifcopenshell
from ifcopenshell import geom
from OCC.Core.BRepGProp import brepgprop_VolumeProperties
from OCC.Core.GProp import GProp_GProps
from collections import Counter

class BuildingElement:
    def __init__(self, global_id, instance_name, type_name, building_storey, material, volume, is_multilayer):
        self.global_id = global_id
        self.instance_name = instance_name
        self.type_name = type_name
        self.building_storey = building_storey
        self.material = material
        self.volume = volume
        self.is_multilayer = is_multilayer

def open_ifc_file(file_path):
    try:
        ifc_file = ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}", file=sys.stderr)
        sys.exit(1)
    return ifc_file

def load_ifc_data(ifc_file):
    elements = ifc_file.by_type("IfcElement")
    if not elements:
        print("No building elements found in the IFC file.")
        sys.exit(1)
    return elements

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

    if ifc_file.schema == 'IFC4' or ifc_file.schema == 'IFC4X3':
        constituent_widths = {}
        constituents = ifc_file.by_type("IfcMaterialConstituent")
        for constituent in constituents:
            next_line_id = constituent.id() + 1
            next_entity = ifc_file.by_id(next_line_id)
            if next_entity and next_entity.is_a("IfcQuantityLength"):
                constituent_widths[constituent.id()] = next_entity.LengthValue

    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterialLayerSetUsage') and material.ForLayerSet and material.ForLayerSet.MaterialLayers:
                    total_thickness = sum(layer.LayerThickness for layer in material.ForLayerSet.MaterialLayers)
                    for layer in material.ForLayerSet.MaterialLayers:
                        layer_volume = total_volume * (layer.LayerThickness / total_thickness)
                        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
                        material_layers_volumes.append(round(layer_volume, 5))
                        material_layers_names.append(layer_name)
                elif ifc_file.schema == 'IFC4' and material.is_a('IfcMaterialConstituentSet'):
                    total_width = sum(constituent_widths.get(constituent.id(), 0) for constituent in material.MaterialConstituents)
                    if total_width > 0:
                        for constituent in material.MaterialConstituents:
                            constituent_id = constituent.id()
                            if constituent_id in constituent_widths:
                                width = constituent_widths[constituent_id]
                                proportion = width / total_width
                                constituent_volume = total_volume * proportion
                                constituent_name = constituent.Name if constituent.Name else "Unnamed Material"
                                material_layers_volumes.append(round(constituent_volume, 5))
                                material_layers_names.append(constituent_name)

    return material_layers_volumes, material_layers_names

def calculate_total_volume_and_details(file_path):
    ifc_file = ifcopenshell.open(file_path)
    elements = ifc_file.by_type("IfcElement")

    settings = geom.settings()
    settings.set(settings.USE_PYTHON_OPENCASCADE, True)
    
    total_volume = 0
    failed_elements = 0  # Counter for elements that failed processing

    for element in elements:
        try:
            shape = geom.create_shape(settings, element)
            prop = GProp_GProps()
            brepgprop_VolumeProperties(shape.geometry, prop)
            volume = prop.Mass()
            total_volume += volume
        except RuntimeError as e:
            #print(f"Warning: Failed to process element {element.id()} due to a runtime error.", file=sys.stderr)
            failed_elements += 1  # Increment the counter for failed elements

    print(f"{total_volume:.3f}")
    
    #if failed_elements > 0:
        #print(f"Warning: {failed_elements} elements failed to process and were skipped.", file=sys.stderr)

#implement this for getting element metadata

def get_building_storey(self, element):
    if element.ContainedInStructure:
        for rel in element.ContainedInStructure:
            if rel.is_a("IfcRelContainedInSpatialStructure"):
                spatial_element = rel.RelatingStructure
                if spatial_element.is_a("IfcBuildingStorey"):
                    return spatial_element.Name if spatial_element.Name else "Unnamed Storey"
    return "N/A"

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_ifc_file>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    calculate_total_volume_and_details(file_path)
