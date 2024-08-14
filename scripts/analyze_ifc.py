import sys
import ifcopenshell
from ifcopenshell import geom
import ifcopenshell.util.element
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

def calculate_volume(shape):
    """Calculates the volume of a given shape."""
    prop = GProp_GProps()
    brepgprop_VolumeProperties(shape.geometry, prop)
    return prop.Mass()



def get_layer_volumes_and_materials(ifc_file, element, total_volume, settings):
    """Extracts volumes and names of material layers for a given building element."""
    material_layers_volumes = []
    material_layers_names = []

    # Get material using the utility function
    material = ifcopenshell.util.element.get_material(element)

    if material:
        if material.is_a('IfcMaterialLayerSetUsage') and material.ForLayerSet and material.ForLayerSet.MaterialLayers:
            # Process MaterialLayerSetUsage to calculate volumes based on layer thickness
            total_thickness = sum(layer.LayerThickness for layer in material.ForLayerSet.MaterialLayers)
            for layer in material.ForLayerSet.MaterialLayers:
                layer_volume = total_volume * (layer.LayerThickness / total_thickness)
                layer_name = layer.Material.Name if layer.Material and layer.Material.Name else "Unnamed Material"
                material_layers_volumes.append(round(layer_volume, 5))
                material_layers_names.append(layer_name)
        
        elif material.is_a('IfcMaterialConstituentSet'):


    logging.debug(f"Material layers volumes: {material_layers_volumes}")
    logging.debug(f"Material layers names: {material_layers_names}")

    return material_layers_volumes, material_layers_names

def get_building_storey(element):
    """Attempts to find the building storey an element is contained in."""
    containing_storey = ifcopenshell.util.element.get_container(element)
    return containing_storey.Name if containing_storey and containing_storey.is_a("IfcBuildingStorey") else None

def get_element_property(element, property_name):
    """Retrieves a specific property value for an IFC element by searching for a property set matching the 'Pset*Common' pattern."""
    matching_property_value = None

    # Iterate through all property sets associated with the element
    for pset_name, properties in ifcopenshell.util.element.get_psets(element).items():
        # Check if the property set name ends with 'Common' and contains the desired property, eg Pset_WallCommon.LoadBearing...
        if pset_name.endswith("Common") and property_name in properties:
            matching_property_value = properties[property_name]
            break

    return matching_property_value

def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id, projectId):
    """Processes a single building element to extract detailed data and metadata."""
    try:
        shape = geom.create_shape(settings, element)
        volume = calculate_volume(shape)
    except Exception as e:
        logging.error(f"Error processing element {element.GlobalId}: {e}")
        return None

    # Pass settings to get_layer_volumes_and_materials
    material_layers_volumes, material_layers_names = get_layer_volumes_and_materials(ifc_file, element, volume, settings)

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

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name or "Unnamed",
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
    client.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        logging.error("Usage: python script.py <path_to_ifc_file> <projectId>")
        sys.exit(1)

    file_path = sys.argv[1]
    projectId = sys.argv[2]
    main(file_path, projectId)
