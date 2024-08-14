#!/opt/miniconda3/bin/python

import sys
import ifcopenshell
from ifcopenshell import geom
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties
from collections import Counter
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import re
import os

# Load environment variables from .env file
load_dotenv()

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
        print("No building elements found in the IFC file.", file=sys.stderr)
        sys.exit(1)
    return elements

def get_class_metadata(elements):
    """
    Returns a Counter object with the number of elements per IFC class
    and a set of unique class names.
    """
    class_counter = Counter()
    unique_classes = set()

    for element in elements:
        class_name = element.is_a()
        class_counter[class_name] += 1
        unique_classes.add(class_name)

    return class_counter, unique_classes

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

    if ifc_file.schema == 'IFC4' or ifc_file.schema == 'IFC4X3':
        # Dictionary to hold the widths of material constituents for volume calculation
        constituent_widths = {}
        # Retrieve all material constituents in the file
        constituents = ifc_file.by_type("IfcMaterialConstituent")
        for constituent in constituents:
            # Attempt to find the next entity which might hold the quantity length
            next_line_id = constituent.id() + 1
            next_entity = ifc_file.by_id(next_line_id)
            if next_entity and next_entity.is_a("IfcQuantityLength"):
                constituent_widths[constituent.id()] = next_entity.LengthValue

    # Process associations to materials for the element
    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                # Process material layer sets
                if material.is_a('IfcMaterialLayerSetUsage') and material.ForLayerSet and material.ForLayerSet.MaterialLayers:
                    total_thickness = sum(layer.LayerThickness for layer in material.ForLayerSet.MaterialLayers)
                    for layer in material.ForLayerSet.MaterialLayers:
                        layer_volume = total_volume * (layer.LayerThickness / total_thickness)
                        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
                        material_layers_volumes.append(round(layer_volume, 5))
                        material_layers_names.append(layer_name)
                # Process material constituent sets (IFC4)
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

def calculate_volume(shape):
    prop = GProp_GProps()
    brepgprop_VolumeProperties(shape.geometry, prop)
    return prop.Mass()

def get_building_storey(element):
    """Attempts to find the building storey an element is contained in."""
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

def get_element_property(element, property_name):
    """
    Retrieves a specific property value for an IFC element by property name directly,
    searching for properties in the Pset_*Common property sets.
    """
    # Define the pattern for the property sets we're interested in
    pattern = re.compile(r'Pset_.*Common')

    # Iterate over the property sets of the element
    for definition in element.IsDefinedBy:
        # Ensure the definition is a property set
        if definition.is_a('IfcRelDefinesByProperties'):
            property_set = definition.RelatingPropertyDefinition
            if property_set.is_a('IfcPropertySet'):
                # Check if the property set name matches the pattern
                if pattern.match(property_set.Name):
                    # Iterate over the properties in the property set
                    for prop in property_set.HasProperties:
                        # Check if the property name matches the desired property
                        if prop.Name == property_name:
                            return prop.NominalValue.wrappedValue
    
    # Return None if the property is not found
    return None


def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
    try:
        shape = geom.create_shape(settings, element)
        volume = calculate_volume(shape)
    except Exception as e:
        print(f"Error processing element {element.GlobalId}: {e}", file=sys.stderr)
        return None

    material_layers_volumes, material_layers_names = get_layer_volumes_and_materials(ifc_file, element, volume)

    # Initialize materials_info with materialId
    materials_info = []

    if material_layers_names:
        materials_info = [{
            "materialId": ObjectId(),  # Generate a new ObjectId for each material
            "name": name,
            "volume": volume
        } for name, volume in zip(material_layers_names, material_layers_volumes)]
    elif volume > 0:
        # For elements with a single material
        material_name, is_multilayer = "Unnamed Material", False
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if materials:
            material_name = materials[0].Name if materials[0].Name else "Unnamed Material"
            is_multilayer = len(materials) > 1
        materials_info.append({
            "materialId": ObjectId(),
            "name": material_name,
            "volume": volume
        })

    is_multilayer = len(materials_info) > 1
    building_storey = get_building_storey(element)
    is_loadbearing = get_element_property(element, "LoadBearing")
    is_external = get_element_property(element, "IsExternal")

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": volume,
        "is_multilayer": is_multilayer,
        "ifc_file_origin": ifc_file_path,
        "user_id": user_id,
        "session_id": session_id,
        "projectId": projectId,
        "building_storey": building_storey,
        "is_loadbearing": is_loadbearing,
        "is_external": is_external
    }
   
    return element_data



def main(file_path, projectId):
    """
    Main function to process the IFC file and store data in MongoDB.
    """
    client = MongoClient(os.getenv("DATABASE_URL"))
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    ifc_file = open_ifc_file(file_path)
    settings = geom.settings()
    settings.set(settings.USE_PYTHON_OPENCASCADE, True)

    user_id = "example_user_id"  # Replace with actual user ID
    session_id = "example_session_id"  # Replace with actual session ID

    elements = load_ifc_data(ifc_file)

    bulk_ops = []  # List to collect bulk operations

    for element in elements:
        element_data = process_element(ifc_file, element, settings, file_path, user_id, session_id, projectId)
        if element_data:
            bulk_ops.append(element_data)

    if bulk_ops:
        collection.insert_many(bulk_ops)  # Perform bulk insert into MongoDB

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    main(file_path, projectId)