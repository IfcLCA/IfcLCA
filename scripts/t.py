import ifcopenshell
from ifcopenshell import geom
import ifcopenshell.util.element
import ifcopenshell.util.shape
import logging
import os
from bson import ObjectId

# Setup logging
logging.basicConfig(level=logging.INFO)

def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        logging.error(f"Error opening IFC file: {e}")
        return None

def get_layer_volumes_from_layerset(material_layers, total_volume):
    if total_volume is None:
        logging.warning("Total volume is None, cannot calculate layer volumes.")
        return [None] * len(material_layers), ["Unnamed Material"] * len(material_layers)
    
    material_layers_volumes = []
    material_layers_names = []

    total_thickness = sum(layer.LayerThickness for layer in material_layers)
    for layer in material_layers:
        layer_volume = total_volume * (layer.LayerThickness / total_thickness)
        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
        material_layers_volumes.append(round(layer_volume, 5))
        material_layers_names.append(layer_name)

    return material_layers_volumes, material_layers_names

def get_volume_from_base_quantities(element):
    base_quantities = ifcopenshell.util.element.get_pset(element, "BaseQuantities", qtos_only=True)
    
    if base_quantities and "NetVolume" in base_quantities:
        return base_quantities["NetVolume"]

    for rel in element.IsDefinedBy:
        if rel.is_a('IfcRelDefinesByProperties'):
            property_set = rel.RelatingPropertyDefinition
            if property_set.is_a('IfcElementQuantity'):
                for quantity in property_set.Quantities:
                    if quantity.is_a('IfcQuantityVolume') and quantity.Name == "NetVolume":
                        return quantity.VolumeValue
    return None

def process_element(ifc_file, element, settings, ifc_file_path):
    # Retrieve quantities (e.g., BaseQuantities)
    net_volume = get_volume_from_base_quantities(element)

    if not net_volume:
        logging.warning(f"No NetVolume found for element {element.GlobalId}")
        try:
            shape = geom.create_shape(settings, element)
            if shape and shape.geometry:
                net_volume = ifcopenshell.util.shape.get_volume(shape.geometry)
            else:
                logging.warning(f"Failed to retrieve geometry for element {element.GlobalId}")
                net_volume = None
        except Exception as e:
            logging.error(f"Error creating shape for element {element.GlobalId}: {e}")
            net_volume = None

    materials_info = []
    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterialLayerSetUsage'):
                    layerset = material.ForLayerSet
                    if net_volume:
                        material_layers_volumes, material_layers_names = get_layer_volumes_from_layerset(layerset.MaterialLayers, net_volume)
                        materials_info = [{
                            "materialId": ObjectId(),
                            "name": name,
                            "volume": volume
                        } for name, volume in zip(material_layers_names, material_layers_volumes)]
                    break

                elif material.is_a('IfcMaterialConstituentSet'):
                    shape_aspects = getattr(element, 'HasShapeAspects', None)
                    if shape_aspects and len(shape_aspects) == len(material.MaterialConstituents):
                        for aspect, constituent in zip(shape_aspects, material.MaterialConstituents):
                            try:
                                shape = geom.create_shape(settings, aspect)
                                aspect_volume = ifcopenshell.util.shape.get_volume(shape.geometry) if shape and shape.geometry else None
                                materials_info.append({
                                    "materialId": ObjectId(),
                                    "name": constituent.Material.Name,
                                    "volume": aspect_volume
                                })
                            except Exception as e:
                                logging.error(f"Error calculating volume for aspect {aspect.GlobalId}: {e}")
                    break

    # Fallback if no shape aspects or multilayer material found
    if not materials_info:
        material_name = "Unnamed Material"
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if materials:
            material_name = materials[0].Name if materials[0].Name else "Unnamed Material"
        materials_info.append({
            "materialId": ObjectId(),
            "name": material_name,
            "volume": net_volume
        })

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": net_volume,
        "ifc_file_origin": ifc_file_path
    }

    return element_data

def process_ifc_file(file_path):
    ifc_file = open_ifc_file(file_path)
    if ifc_file:
        settings = geom.settings()

        elements = ifc_file.by_type("IfcElement")
        print(f"\n---\nProcessing file: {os.path.basename(file_path)}")
        print(f"Total elements found: {len(elements)}")

        # Process each element
        for element in elements[:5]:  # Limiting to the first 5 elements for brevity
            element_data = process_element(ifc_file, element, settings, file_path)
            
            if element_data:
                print(f"Element GUID: {element_data['guid']}, Type: {element_data['ifc_class']}, Volume: {element_data['total_volume']} m³")
                for material in element_data['materials_info']:
                    print(f"  Material: {material['name']}, Volume: {material['volume']} m³")
            else:
                print(f"Failed to process element {element.GlobalId}")

if __name__ == "__main__":
    folder_path = "C:/Users/LouisTrümpler/Documents/GitHub/01_IfcLCA/testfiles"

    # List all IFC files in the directory
    ifc_files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith('.ifc')]

    if not ifc_files:
        print("No IFC files found in the folder.")
    else:
        # Process each IFC file and print results to console
        for ifc_file_path in ifc_files:
            process_ifc_file(ifc_file_path)
