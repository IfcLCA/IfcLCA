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

# Assign fractions to material constituents based on their widths
def compute_constituent_fractions(model, constituent_set, associated_elements, unit_scale_to_mm):
    """
    Computes fractions for each material constituent based on their widths. Uses width as a fallback.

    Parameters:
    - model: The opened IfcOpenShell IFC model.
    - constituent_set: The IfcMaterialConstituentSet instance.
    - associated_elements: List of elements associated with the constituent set.
    - unit_scale_to_mm: Scaling factor to convert lengths to millimeters.

    Returns:
    - A dictionary mapping each constituent to its fraction.
    """
    fractions = {}
    constituents = constituent_set.MaterialConstituents or []
    if not constituents:
        return fractions  # No constituents to process

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
            for sub_q in getattr(matched_quantity, 'HasQuantities', []):
                if sub_q.is_a('IfcQuantityLength') and (sub_q.Name or '').strip().lower() == 'width':
                    raw_length_value = getattr(sub_q, 'LengthValue', 0.0)
                    width_mm = raw_length_value * unit_scale_to_mm
                    break

        constituent_widths[constituent] = width_mm
        total_width_mm += width_mm

    if total_width_mm == 0.0:
        # Assign equal fractions if total width is zero
        fractions = {constituent: 1.0 / len(constituents) for constituent in constituents}
    else:
        fractions = {constituent: (width_mm / total_width_mm) for constituent, width_mm in constituent_widths.items()}

    return fractions

# Simplified material extraction with error handling and fraction computation
def get_layer_volumes_and_materials(model, element, total_volume, unit_scale_to_mm):
    material_layers_volumes = []
    material_layers_names = []
    material_layers_fractions = []

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
                        material_layers_fractions.append(layer.LayerThickness / total_thickness if total_thickness else 0)

                elif material.is_a('IfcMaterialConstituentSet') and hasattr(material, 'MaterialConstituents'):
                    # Compute fractions based on widths
                    associated_relations = model.get_inverse(material)
                    associated_elements = [
                        rel.RelatedObjects[0] for rel in associated_relations
                        if rel.is_a('IfcRelAssociatesMaterial') and rel.RelatedObjects
                    ]
                    fractions = compute_constituent_fractions(model, material, associated_elements, unit_scale_to_mm)

                    for constituent in material.MaterialConstituents:
                        constituent_name = constituent.Name if constituent.Name else "Unnamed Material"
                        fraction = fractions.get(constituent, 1.0 / len(material.MaterialConstituents))  # Fallback to equal fraction
                        material_volume = total_volume * fraction if total_volume else 0
                        material_layers_volumes.append(round(material_volume, 5))
                        material_layers_names.append(constituent_name)
                        material_layers_fractions.append(fraction)

    return material_layers_volumes, material_layers_names, material_layers_fractions

# Process each IFC element to extract data 
def process_element(model, element, file_path, user_id, session_id, projectId, unit_scale_to_mm):
    # Try to get volume from properties or BaseQuantities
    volume = get_volume_from_properties(element)
    if volume is None:
        volume = 0  # Use 0 for volume when none is found

    # Get material layers and volumes
    material_layers_volumes, material_layers_names, material_layers_fractions = get_layer_volumes_and_materials(model, element, volume, unit_scale_to_mm)

    # Build material info
    materials_info = []
    for name, vol, frac in zip(material_layers_names, material_layers_volumes, material_layers_fractions):
        materials_info.append({
            "materialId": ObjectId(),
            "name": name,
            "volume": vol,
            "fraction": frac
        })

    if not materials_info:
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if materials:
            material_name = materials[0].Name if materials[0].Name else "Unnamed Material"
            materials_info.append({
                "materialId": ObjectId(),
                "name": material_name,
                "volume": volume,
                "fraction": 1.0
            })
        else:
            # No materials found; optionally handle this case
            materials_info.append({
                "materialId": ObjectId(),
                "name": "No Material",
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

    # Optional: Print constituent details for debugging
    for info in materials_info:
        print(f"Element: {element.Name or 'Unnamed'}, Constituent: {info['name']}, Volume: {info['volume']} m³, Fraction: {info['fraction']:.4f}")

    return element_data


# Main function to process the entire IFC file
def main(file_path, projectId):
    client = AsyncIOMotorClient(os.getenv("DATABASE_URL"), maxPoolSize=500)
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    model = open_ifc_file(file_path)

    # Initialize variables for batch processing
    batch_size = 500
    bulk_ops = []

    # Process each batch of IFC elements
    for batch in load_ifc_data_in_batches(model, batch_size=batch_size):
        processed_elements = [process_element(model, element, file_path, projectId) for element in batch]
        processed_elements = [elem for elem in processed_elements if elem is not None]
        if processed_elements:
            bulk_ops.extend(processed_elements)

    # Insert all processed elements into MongoDB
    if bulk_ops:
        asyncio.run(collection.insert_many(bulk_ops))
        print(f"Inserted {len(bulk_ops)} elements into MongoDB.")

    client.close()
    print("Processing complete.")

# Script entry point
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <projectId>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    main(file_path, projectId)