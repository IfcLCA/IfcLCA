#!/opt/miniconda3/bin/python

import sys
import ifcopenshell
from ifcopenshell import geom
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}")
        sys.exit(1)

def get_layer_volumes_from_layerset(material_layers, total_volume):
    material_layers_volumes = []
    material_layers_names = []

    total_thickness = sum(layer.LayerThickness for layer in material_layers)
    for layer in material_layers:
        layer_volume = total_volume * (layer.LayerThickness / total_thickness)
        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
        material_layers_volumes.append(round(layer_volume, 5))
        material_layers_names.append(layer_name)

    return material_layers_volumes, material_layers_names

def get_volume_from_base_quantities(qtos):
    if "NetVolume" in qtos:
        return qtos["NetVolume"]
    return None

def get_building_storey(element):
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

def get_element_property(element, property_name):
    psets = ifcopenshell.util.element.get_psets(element)
    for pset in psets.values():
        if property_name in pset:
            return pset[property_name]
    return None

async def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
    qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)
    net_volume = get_volume_from_base_quantities(qtos)

    if not net_volume:  # Fall back to geometry calculation if NetVolume is missing
        shape = geom.create_shape(settings, element)
        net_volume = ifcopenshell.util.shape.get_volume(shape.geometry)

    materials_info = []
    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterialLayerSetUsage'):
                    layerset = material.ForLayerSet
                    material_layers_volumes, material_layers_names = get_layer_volumes_from_layerset(layerset.MaterialLayers, net_volume)
                    materials_info = [{
                        "materialId": ObjectId(),
                        "name": name,
                        "volume": volume
                    } for name, volume in zip(material_layers_names, material_layers_volumes)]
                    break

                elif material.is_a('IfcMaterialConstituentSet'):
                    shape_aspects = element.HasShapeAspects
                    if shape_aspects and len(shape_aspects) == len(material.MaterialConstituents):
                        for aspect, constituent in zip(shape_aspects, material.MaterialConstituents):
                            aspect_volume = ifcopenshell.util.shape.get_volume(geom.create_shape(settings, aspect).geometry)
                            materials_info.append({
                                "materialId": ObjectId(),
                                "name": constituent.Material.Name,
                                "volume": aspect_volume
                            })
                    break

    if not materials_info:  # Single-layer fallback
        material_name = "Unnamed Material"
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if materials:
            material_name = materials[0].Name if materials[0].Name else "Unnamed Material"
        materials_info.append({
            "materialId": ObjectId(),
            "name": material_name,
            "volume": net_volume
        })

    # Fetch additional properties like building storey, loadbearing, and externality
    building_storey = get_building_storey(element)
    is_loadbearing = get_element_property(element, "LoadBearing")
    is_external = get_element_property(element, "IsExternal")

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": net_volume,
        "is_multilayer": len(materials_info) > 1,
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

    elements = ifc_file.by_type("IfcElement")

    bulk_ops = []
    for element in elements:
        element_data = await process_element(ifc_file, element, settings, file_path, user_id, session_id, projectId)
        if element_data:
            bulk_ops.append(element_data)

    if bulk_ops:
        await collection.insert_many(bulk_ops)

    basic_info = {
        "elementCount": len(elements),
        "uniqueMaterials": list({mat["name"] for elem in bulk_ops for mat in elem["materials_info"]})
    }
    return basic_info

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>")
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    asyncio.run(main(file_path, projectId))
