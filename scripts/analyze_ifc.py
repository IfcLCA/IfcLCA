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
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}", file=sys.stderr)
        sys.exit(1)

def load_ifc_data(ifc_file):
    elements = ifc_file.by_type("IfcElement")
    if not elements:
        print("No building elements found in the IFC file.", file=sys.stderr)
        sys.exit(1)
    return elements

def get_unique_materials(ifc_file):
    materials = set()
    for element in ifc_file.by_type("IfcElement"):
        element_materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if element_materials:
            materials.update(mat.Name for mat in element_materials if mat.Name)
    return list(materials)

def extract_basic_info(ifc_file):
    elements = load_ifc_data(ifc_file)
    element_count = len(elements)
    unique_materials = get_unique_materials(ifc_file)

    return {
        "elementCount": element_count,
        "uniqueMaterials": unique_materials
    }

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

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

                #TODO: Add support for IfcMaterialConstituentSet by calculating volumes for each constituent (how to get from geometry to constituent isnt clear, maybe impossible...)
                elif ifc_file.schema == 'IFC4' and material.is_a('IfcMaterialConstituentSet'):
                    # Use the first constituent's material for the entire element
                    first_constituent = material.MaterialConstituents[0]
                    constituent_name = first_constituent.Name if first_constituent.Name else "Unnamed Material"
                    material_layers_volumes.append(round(total_volume, 5))
                    material_layers_names.append(constituent_name)
                    break  # Exit loop after using the first constituent

    return material_layers_volumes, material_layers_names

def calculate_volume(shape):
    prop = GProp_GProps()
    brepgprop_VolumeProperties(shape.geometry, prop)
    return prop.Mass()

def get_building_storey(element):
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

def get_element_property(element, property_name):
    pattern = re.compile(r'Pset_.*Common')

    for definition in element.IsDefinedBy:
        if definition.is_a('IfcRelDefinesByProperties'):
            property_set = definition.RelatingPropertyDefinition
            if property_set.is_a('IfcPropertySet') and pattern.match(property_set.Name):
                for prop in property_set.HasProperties:
                    if prop.Name == property_name:
                        return prop.NominalValue.wrappedValue
    return None

async def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
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
            "materialId": ObjectId(),
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

async def main(file_path, projectId):
    client = AsyncIOMotorClient(os.getenv("DATABASE_URL"))
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    ifc_file = open_ifc_file(file_path)
    settings = geom.settings()
    settings.set(settings.USE_PYTHON_OPENCASCADE, True)

    user_id = "example_user_id"
    session_id = "example_session_id"

    elements = load_ifc_data(ifc_file)

    bulk_ops = []

    for element in elements:
        element_data = await process_element(ifc_file, element, settings, file_path, user_id, session_id, projectId)
        if element_data:
            bulk_ops.append(element_data)

    if bulk_ops:
        await collection.insert_many(bulk_ops)

    basic_info = extract_basic_info(ifc_file)
    return basic_info

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    asyncio.run(main(file_path, projectId))