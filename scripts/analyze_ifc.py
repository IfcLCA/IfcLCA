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

def calculate_bounding_box(curve):
    """
    Calculate the bounding box for an IfcIndexedPolyCurve by examining the points
    in the IfcCartesianPointList2D.

    :param curve: An IfcIndexedPolyCurve that defines the profile's boundary.
    :return: A dictionary with the bounding box dimensions: {"width": width, "height": height}
    """
    if not curve.is_a("IfcIndexedPolyCurve"):
        raise NotImplementedError(f"Curve type {curve.is_a()} not supported for bounding box calculation.")
    
    point_list = curve.Points
    coordinates = point_list.CoordList

    # Initialize min and max coordinates with extreme values
    min_x = float('inf')
    max_x = float('-inf')
    min_y = float('inf')
    max_y = float('-inf')

    # Iterate over the coordinate pairs
    for coord in coordinates:
        x, y = coord[0], coord[1]
        
        if x < min_x:
            min_x = x
        if x > max_x:
            max_x = x
        if y < min_y:
            min_y = y
        if y > max_y:
            max_y = y

    # Calculate the width and height of the bounding box
    width = max_x - min_x
    height = max_y - min_y

    return {"width": width, "height": height}

def approximate_arbitrary_profile_area(profile):
    """
    Approximate the area of an IfcArbitraryClosedProfileDef by assuming a bounding rectangle.
    """
    curve = profile.OuterCurve  # The boundary curve
    bounding_box = calculate_bounding_box(curve)
    area = bounding_box["width"] * bounding_box["height"]
    return area

def calculate_extruded_area_solid_volume(extruded_area_solid):
    profile = extruded_area_solid.SweptArea
    
    if profile.is_a("IfcRectangleProfileDef"):
        area = profile.XDim * profile.YDim
    elif profile.is_a("IfcCircleProfileDef"):
        radius = profile.Radius
        area = 3.14159 * radius * radius
    elif profile.is_a("IfcArbitraryClosedProfileDef"):
        area = approximate_arbitrary_profile_area(profile)
    else:
        raise NotImplementedError(f"Profile type {profile.is_a()} not supported for area calculation.")

    depth = extruded_area_solid.Depth
    volume = area * depth

    return volume

def find_extruded_solid(element):
    """
    Finds an IfcExtrudedAreaSolid within the element's shape representation,
    considering relationships through IfcShapeAspect and related entities.
    """
    if element.Representation:
        for rep in element.Representation.Representations:
            for item in rep.Items:
                if item.is_a("IfcExtrudedAreaSolid"):
                    return item

    # Navigate through IfcShapeAspect if needed
    if element.IsDefinedBy:
        for rel in element.IsDefinedBy:
            if rel.is_a("IfcRelDefinesByType"):
                element_type = rel.RelatingType
                if element_type.RepresentationMaps:
                    for rep_map in element_type.RepresentationMaps:
                        shape = rep_map.MappedRepresentation
                        for item in shape.Items:
                            if item.is_a("IfcExtrudedAreaSolid"):
                                return item
    return None

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

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
                    for constituent in material.MaterialConstituents:
                        solid = find_extruded_solid(element)
                        if solid and solid.is_a("IfcExtrudedAreaSolid"):
                            volume = calculate_extruded_area_solid_volume(solid)
                            constituent_name = constituent.Name if constituent.Name else "Unnamed Material"
                            material_layers_volumes.append(round(volume, 5))
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