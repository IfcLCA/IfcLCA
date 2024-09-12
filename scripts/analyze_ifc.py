#!/opt/miniconda3/bin/python

import sys
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.shape
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId
import multiprocessing


load_dotenv()

# Initialize ThreadPoolExecutor globally for concurrent shape creation
executor = ThreadPoolExecutor(max_workers=multiprocessing.cpu_count())

# Open IFC file and load data
def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}", file=sys.stderr)
        sys.exit(1)

# Lazy loading and batching of IFC elements
def load_ifc_data_in_batches(ifc_file, batch_size=100):
    elements = ifc_file.by_type("IfcProduct")
    for i in range(0, len(elements), batch_size):
        yield elements[i:i + batch_size]

# Simplified material extraction with error handling
def get_layer_volumes_and_materials(element, total_volume):
    material_layers_volumes = []
    material_layers_names = []

    if total_volume is None:
        total_volume = 0  # If volume is None, set to 0 for reporting

    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterialLayerSetUsage'):
                    total_thickness = sum(layer.LayerThickness for layer in material.ForLayerSet.MaterialLayers)
                    for layer in material.ForLayerSet.MaterialLayers:
                        layer_volume = total_volume * (layer.LayerThickness / total_thickness) if total_volume else 0
                        layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
                        material_layers_volumes.append(round(layer_volume, 5))
                        material_layers_names.append(layer_name)

                elif material.is_a('IfcMaterialConstituentSet') and hasattr(material, 'MaterialConstituents'):
                    # Assign total volume to the first constituent and set the rest to 0
                    for i, constituent in enumerate(material.MaterialConstituents):
                        constituent_name = constituent.Name if constituent.Name else "Unnamed Material"
                        material_volume = total_volume if i == 0 else 0  # First constituent gets the total volume, others get 0
                        material_layers_volumes.append(round(material_volume, 5))
                        material_layers_names.append(constituent_name)

    return material_layers_volumes, material_layers_names

# Attempt to retrieve the volume from the element's BaseQuantities
def get_volume_from_basequantities(element):
    for rel_def in element.IsDefinedBy:
        if rel_def.is_a("IfcRelDefinesByProperties"):
            prop_set = rel_def.RelatingPropertyDefinition
            if prop_set.is_a("IfcElementQuantity"):
                for quantity in prop_set.Quantities:
                    # Handle volume quantities
                    if quantity.is_a("IfcQuantityVolume") and (quantity.Name == "NetVolume" or quantity.Name == "GrossVolume"):
                        try:
                            return float(quantity.VolumeValue)
                        except (ValueError, AttributeError):
                            continue
                    
                    # Handle length-based quantities which may represent volumes (e.g., NetVolume in IFCQUANTITYLENGTH)
                    if quantity.is_a("IfcQuantityLength") and (quantity.Name == "NetVolume" or quantity.Name == "GrossVolume"):
                        try:
                            return float(quantity.LengthValue)  # Accessing LengthValue for volume
                        except (ValueError, AttributeError):
                            continue
    return None


# Attempt to retrieve the volume from the element's properties
def get_volume_from_properties(element):
    # First try to get the volume from BaseQuantities
    volume = get_volume_from_basequantities(element)
    if volume is not None:
        return volume

    # If no volume is found in BaseQuantities, use properties (Psets)
    volume = get_element_property(element, "NetVolume") or get_element_property(element, "GrossVolume")
    if volume:
        try:
            return float(volume)
        except ValueError:
            return None
    return None

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
async def process_element(element, file_path, user_id, session_id, projectId):
    # Try to get volume from properties or BaseQuantities
    volume = get_volume_from_properties(element)
    if volume is None:
        volume = 0  # Use 0 for volume when none is found

    # Get material layers and volumes
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

    # Build the element data dictionary for output
    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": volume,
        "is_multilayer": len(materials_info) > 1,
        "ifc_file_origin": file_path,
        "user_id": user_id,
        "session_id": session_id,
        "projectId": projectId,
        "building_storey": get_building_storey(element),
        "is_loadbearing": get_element_property(element, "LoadBearing"),
        "is_external": get_element_property(element, "IsExternal")
    }

    return element_data


# Main function to process each batch of elements asynchronously
async def process_batch(ifc_file, batch, file_path, user_id, session_id, projectId):
    tasks = [process_element(element, file_path, user_id, session_id, projectId) for element in batch]
    return await asyncio.gather(*tasks)

# Main function to process the entire IFC file
async def main(file_path, projectId):
    client = AsyncIOMotorClient(os.getenv("DATABASE_URL"), maxPoolSize=500)
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    ifc_file = open_ifc_file(file_path)

    # Mock data for user_id and session_id
    user_id = "example_user_id"   
    session_id = "example_session_id" 

    # Initialize variables for batch processing
    bulk_ops = []  # Initialize the list for bulk MongoDB operations
    batch_count = 0  # Initialize the batch counter

    # Process each batch of IFC elements
    for batch in load_ifc_data_in_batches(ifc_file, batch_size=500):
        # Process the elements in the batch asynchronously
        processed_elements = await process_batch(ifc_file, batch, file_path, user_id, session_id, projectId)

        # Append the processed elements to bulk operations
        bulk_ops.extend(processed_elements)
        batch_count += 1
        
        # Insert the accumulated bulk operations into MongoDB every 5 batches
        if batch_count % 5 == 0 and bulk_ops:
            await collection.insert_many(bulk_ops)
            bulk_ops.clear()  # Clear the bulk operations after insertion

    # Insert any remaining operations after the loop ends
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
