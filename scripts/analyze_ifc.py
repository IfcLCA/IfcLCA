import sys
import ifcopenshell
from ifcopenshell import geom
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import os
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

def open_ifc_file(file_path):
    """Opens an IFC file using ifcopenshell."""
    try:
        ifc_file = ifcopenshell.open(file_path)
        logging.info(f"Successfully opened IFC file: {file_path}")
        return ifc_file
    except Exception as e:
        logging.error(f"Error opening IFC file: {e}")
        sys.exit(1)

def load_ifc_data(ifc_file):
    """Loads all elements of type 'IfcElement' from the IFC file."""
    elements = ifc_file.by_type("IfcElement")
    if not elements:
        logging.error("No building elements found in the IFC file.")
        sys.exit(1)
    return elements

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    """Extracts volumes and names of material layers for a given building element."""
    material_layers_volumes = []
    material_layers_names = []

    if ifc_file.schema in ['IFC4', 'IFC4X3']:
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
                elif ifc_file.schema in ['IFC4', 'IFC4X3'] and material.is_a('IfcMaterialConstituentSet'):
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

    logging.debug(f"Material layers volumes: {material_layers_volumes}")
    logging.debug(f"Material layers names: {material_layers_names}")

    return material_layers_volumes, material_layers_names

def calculate_volume(shape):
    """Calculates the volume of a given shape."""
    prop = GProp_GProps()
    brepgprop_VolumeProperties(shape.geometry, prop)
    return prop.Mass()

def get_building_storey(element):
    """Attempts to find the building storey an element is contained in."""
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

def get_element_property(element, property_name):
    """Retrieves a specific property value for an IFC element by property name directly."""
    psets = ifcopenshell.util.element.get_psets(element)
    return next((properties[property_name] for properties in psets.values() if property_name in properties), None)

def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
    """Processes a single building element to extract detailed data and metadata."""
    try:
        shape = geom.create_shape(settings, element)
        volume = calculate_volume(shape)
        logging.debug(f"Processed element {element.GlobalId} with volume {volume}")
    except Exception as e:
        logging.error(f"Error processing element {element.GlobalId}: {e}")
        return None

    material_layers_volumes, material_layers_names = get_layer_volumes_and_materials(ifc_file, element, volume)

    materials_info = [
        {
            "materialId": ObjectId(),
            "name": name,
            "volume": layer_volume
        }
        for name, layer_volume in zip(material_layers_names, material_layers_volumes)
    ] if material_layers_names else [{
        "materialId": ObjectId(),
        "name": "Unnamed Material",
        "volume": volume
    }]

    is_multilayer = len(materials_info) > 1
    building_storey = get_building_storey(element)
    is_loadbearing = get_element_property(element, "IsLoadbearing")
    is_external = get_element_property(element, "IsExternal")

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name or "Unnamed",
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

def main(file_path, projectId, batch_size=1000):
    """Main function to process the IFC file and store data in MongoDB."""
    load_dotenv()  # Load environment variables
    client = MongoClient(os.getenv("DATABASE_URL"))
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
        element_data = process_element(ifc_file, element, settings, file_path, user_id, session_id, projectId)
        if element_data:
            bulk_ops.append(element_data)
        
        if len(bulk_ops) >= batch_size:
            collection.insert_many(bulk_ops)
            bulk_ops.clear()

    if bulk_ops:
        collection.insert_many(bulk_ops)
    client.close()  # Ensure the MongoDB client is properly closed

if __name__ == "__main__":
    if len(sys.argv) != 3:
        logging.error("Usage: python script.py <path_to_ifc_file> <projectId>")
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    main(file_path, projectId)