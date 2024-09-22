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

from ifcopenshell.util.unit import calculate_unit_scale

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
    elements = ifc_file.by_type("IfcElement")
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
                    # Assign fractions based on widths or use widths as fallback
                    fractions = assign_constituent_fractions(material, element)
                    for i, constituent in enumerate(material.MaterialConstituents):
                        constituent_name = constituent.Name if constituent.Name else "Unnamed Material"
                        material_volume = total_volume * fractions[i] if total_volume else 0
                        material_layers_volumes.append(round(material_volume, 5))
                        material_layers_names.append(constituent_name)

    return material_layers_volumes, material_layers_names

def assign_constituent_fractions(constituent_set, element):
    """
    Assigns fractions to material constituents based on their widths. If widths are not available,
    uses width as a fallback to compute fractions.

    Parameters:
    - constituent_set: The IfcMaterialConstituentSet instance.
    - element: The IfcElement associated with the constituent set.

    Returns:
    - List of fractions corresponding to each constituent.
    """
    fractions = []
    unit_scale_to_mm = 1000.0  # Assuming model units are in meters; adjust as needed

    constituents = constituent_set.MaterialConstituents or []
    if not constituents:
        return [1.0] * len(constituents)  # Avoid division by zero

    # Find elements associated with this constituent set via IfcRelAssociatesMaterial
    associated_relations = element.get_inverse('IfcRelAssociatesMaterial')
    associated_elements = [
        rel.RelatedObjects[0] for rel in associated_relations
        if rel.is_a('IfcRelAssociatesMaterial') and rel.RelatedObjects
    ]
    if not associated_elements:
        return [1.0] * len(constituents)  # Default fraction if no associated elements

    # Collect quantities associated with the elements
    quantities = []
    for assoc_element in associated_elements:
        for rel in getattr(assoc_element, 'IsDefinedBy', []):
            if rel.is_a('IfcRelDefinesByProperties'):
                prop_def = rel.RelatingPropertyDefinition
                if prop_def.is_a('IfcElementQuantity'):
                    quantities.extend(prop_def.Quantities)

    # Build a mapping of quantity names to quantities
    quantity_name_map = {}
    for q in quantities:
        if q.is_a('IfcPhysicalComplexQuantity'):
            q_name = (q.Name or '').strip().lower()
            quantity_name_map.setdefault(q_name, []).append(q)

    # Handle constituents with duplicate names by order of appearance
    constituent_indices = {}
    constituent_widths = {}
    total_width_mm = 0.0

    for constituent in constituents:
        constituent_name = (constituent.Name or "Unnamed Constituent").strip().lower()
        count = constituent_indices.get(constituent_name, 0)
        constituent_indices[constituent_name] = count + 1

        width_mm = 0.0
        quantities_with_name = quantity_name_map.get(constituent_name, [])

        if count < len(quantities_with_name):
            matched_quantity = quantities_with_name[count]
            # Extract 'Width' sub-quantity
            for sub_q in matched_quantity.HasQuantities:
                if sub_q.is_a('IfcQuantityLength') and (sub_q.Name or '').strip().lower() == 'width':
                    raw_length_value = sub_q.LengthValue or 0.0
                    width_mm = raw_length_value * unit_scale_to_mm
                    break

        constituent_widths[constituent] = width_mm
        total_width_mm += width_mm

    if total_width_mm == 0.0:
        # If total width is zero, assign equal fractions
        fractions = [1.0 / len(constituents)] * len(constituents)
    else:
        fractions = [constituent_widths[constituent] / total_width_mm for constituent in constituents]

    return fractions

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

    # Build material info with fractions
    materials_info = []
    for name, vol in zip(material_layers_names, material_layers_volumes):
        fraction = vol / volume if volume > 0 else 0
        materials_info.append({
            "materialId": ObjectId(),
            "name": name,
            "volume": vol,
            "fraction": fraction
        })

    if not materials_info:
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        material_name = materials[0].Name if materials and materials[0].Name else "Unnamed Material"
        materials_info.append({
            "materialId": ObjectId(),
            "name": material_name,
            "volume": volume,
            "fraction": 1.0
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

    # Initialize fractions for all material constituents before processing elements
    assign_global_constituent_fractions(ifc_file)

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

def assign_global_constituent_fractions(model):
    """
    Assigns fractions to all IfcMaterialConstituentSets in the IFC model based on their widths.
    This function modifies the IFC model in-memory.

    Parameters:
    - model: The opened IfcOpenShell IFC model.
    """
    # Calculate the unit scale for length units to millimeters
    unit_scale_to_mm = calculate_unit_scale(model) * 1000.0

    # Iterate through each IfcMaterialConstituentSet in the model
    for constituent_set in model.by_type('IfcMaterialConstituentSet'):
        constituents = constituent_set.MaterialConstituents or []
        if not constituents:
            continue  # Skip if no constituents found

        # Find elements associated with this constituent set via IfcRelAssociatesMaterial
        associated_relations = model.get_inverse(constituent_set)
        associated_elements = [
            rel.RelatedObjects[0] for rel in associated_relations
            if rel.is_a('IfcRelAssociatesMaterial') and rel.RelatedObjects
        ]
        if not associated_elements:
            continue  # Skip if no associated elements found

        # Collect quantities associated with the elements
        quantities = []
        for element in associated_elements:
            for rel in getattr(element, 'IsDefinedBy', []):
                if rel.is_a('IfcRelDefinesByProperties'):
                    prop_def = rel.RelatingPropertyDefinition
                    if prop_def.is_a('IfcElementQuantity'):
                        quantities.extend(prop_def.Quantities)

        # Build a mapping of quantity names to quantities
        quantity_name_map = {}
        for q in quantities:
            if q.is_a('IfcPhysicalComplexQuantity'):
                q_name = (q.Name or '').strip().lower()
                quantity_name_map.setdefault(q_name, []).append(q)

        # Handle constituents with duplicate names by order of appearance
        constituent_indices = {}
        constituent_widths = {}
        total_width_mm = 0.0

        for constituent in constituents:
            constituent_name = (constituent.Name or "Unnamed Constituent").strip().lower()
            count = constituent_indices.get(constituent_name, 0)
            constituent_indices[constituent_name] = count + 1

            width_mm = 0.0
            quantities_with_name = quantity_name_map.get(constituent_name, [])

            if count < len(quantities_with_name):
                matched_quantity = quantities_with_name[count]
                # Extract 'Width' sub-quantity
                for sub_q in matched_quantity.HasQuantities:
                    if sub_q.is_a('IfcQuantityLength') and (sub_q.Name or '').strip().lower() == 'width':
                        raw_length_value = sub_q.LengthValue or 0.0
                        width_mm = raw_length_value * unit_scale_to_mm
                        break

            constituent_widths[constituent] = width_mm
            total_width_mm += width_mm

        if total_width_mm == 0.0:
            # Assign equal fractions if total width is zero
            fractions = [1.0 / len(constituents)] * len(constituents)
        else:
            fractions = [constituent_widths[constituent] / total_width_mm for constituent in constituents]

        # Assign fractions to constituents
        for constituent, fraction in zip(constituents, fractions):
            constituent.Fraction = fraction
            print(f"Constituent: {constituent.Name}, Fraction: {fraction:.4f}, Width: {constituent_widths.get(constituent, 0):.2f} mm")

# Script entry point
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    asyncio.run(main(file_path, projectId))
