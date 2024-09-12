#!/opt/miniconda3/bin/python

import sys
import ifcopenshell
from ifcopenshell import geom
import ifcopenshell.util.element
import ifcopenshell.util.shape
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

# Initialize ThreadPoolExecutor globally for concurrent shape creation
executor = ThreadPoolExecutor(max_workers=10)  # Adjust the worker count as needed

# Open IFC file and load data
def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}", file=sys.stderr)
        sys.exit(1)

# Lazy loading and batching of IFC elements
def load_ifc_data_in_batches(ifc_file, batch_size=100):
    elements = ifc_file.by_type("IfcElement")
    for i in range(0, len(elements), batch_size):
        yield elements[i:i + batch_size]

# Simplified material extraction with error handling
def get_layer_volumes_and_materials(element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

    if total_volume is None:
        return material_layers_volumes, material_layers_names

    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterialLayerSetUsage'):
                    total_thickness = sum(layer.LayerThickness for layer in material.ForLayerSet.MaterialLayers)
                    for layer in material.ForLayerSet.MaterialLayers:
                        layer_volume = total_volume * (layer.LayerThickness / total_thickness)
                        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
                        material_layers_volumes.append(round(layer_volume, 5))
                        material_layers_names.append(layer_name)

                elif material.is_a('IfcMaterialConstituentSet') and hasattr(material, 'MaterialConstituents'):
                    first_constituent = material.MaterialConstituents[0]
                    constituent_name = first_constituent.Name if first_constituent.Name else "Unnamed Material"
                    material_layers_volumes.append(round(total_volume, 5))
                    material_layers_names.append(constituent_name)

    return material_layers_volumes, material_layers_names

# Attempt to retrieve the volume from the element's properties
def get_volume_from_properties(element):
    volume = get_element_property(element, "NetVolume") or get_element_property(element, "GrossVolume")
    if volume:
        try:
            return float(volume)
        except ValueError:
            return None
    return None

# Calculate volume from element shape (runs in thread pool)
async def calculate_volume(shape):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, ifcopenshell.util.shape.get_volume, shape.geometry)

# Get building storey and properties
def get_building_storey(element):
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

# Get properties from the element
def get_element_property(element, property_name):
    element_class = element.is_a()[3:]  # Strip 'Ifc' from class name
    pset_name = f"Pset_{element_class}Common"
    return ifcopenshell.util.element.get_pset(element, pset_name, property_name) or ifcopenshell.util.element.get_pset(element, "Pset_ElementCommon", property_name)

# Process each IFC element to extract data (runs async)
async def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
    # Try to get volume from properties first
    volume = get_volume_from_properties(element)

    # If volume is not found in properties, calculate it from the shape
    if volume is None:
        try:
            shape = geom.create_shape(settings, element)
            volume = await calculate_volume(shape)
        except Exception as e:
            print(f"Error processing element {element.GlobalId}: {e}", file=sys.stderr)
            return None

    material_layers_volumes, material_layers_names = get_layer_volumes_and_materials(element, volume)

    # Build material info
    materials_info = [{
        "materialId": ObjectId(),
        "name": name,
        "volume": vol
    } for name, vol in zip(material_layers_names, material_layers_volumes)]

    if not materials_info:
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        material_name = materials[0].Name if materials and materials[0].Name else "Unnamed Material"
        materials_info.append({
            "materialId": ObjectId(),
            "name": material_name,
            "volume": volume
        })

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": volume,
        "is_multilayer": len(materials_info) > 1,
        "ifc_file_origin": ifc_file_path,
        "user_id": user_id,
        "session_id": session_id,
        "projectId": projectId,
        "building_storey": get_building_storey(element),
        "is_loadbearing": get_element_property(element, "LoadBearing"),
        "is_external": get_element_property(element, "IsExternal")
    }
    print(element_data)
    return element_data

# Main function to process the entire IFC file
async def process_batch(ifc_file, batch, settings, file_path, user_id, session_id, projectId):
    tasks = [process_element(ifc_file, element, settings, file_path, user_id, session_id, projectId) for element in batch]
    return await asyncio.gather(*tasks)

async def main(file_path, projectId):
    client = AsyncIOMotorClient(os.getenv("DATABASE_URL"), maxPoolSize=100)
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    ifc_file = open_ifc_file(file_path)
    settings = geom.settings()

    user_id = "example_user_id"
    session_id = "example_session_id"

    # Process elements in batches
    for batch in load_ifc_data_in_batches(ifc_file, batch_size=500):
        bulk_ops = []
        processed_elements = await process_batch(ifc_file, batch, settings, file_path, user_id, session_id, projectId)
        
        for element_data in processed_elements:
            if element_data:
                bulk_ops.append(element_data)

        # Insert each batch of elements into MongoDB
        if bulk_ops:
            await collection.insert_many(bulk_ops)

# Script entry point
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    asyncio.run(main(file_path, projectId))
