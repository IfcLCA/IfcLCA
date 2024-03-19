import sys
import ifcopenshell
from ifcopenshell import geom
from OCC.Core.BRepGProp import brepgprop_VolumeProperties
from OCC.Core.GProp import GProp_GProps
from collections import Counter
import pymongo

def open_ifc_file(file_path):
    """
    Opens an IFC file using ifcopenshell.

    Args:
        file_path (str): Path to the IFC file.

    Returns:
        ifc_file: The opened IFC file object.

    Exits:
        If the IFC file cannot be opened, the script exits with an error message.
    """
    try:
        ifc_file = ifcopenshell.open(file_path)
    except Exception as e:
        print(f"Error opening IFC file: {e}", file=sys.stderr)
        sys.exit(1)
    return ifc_file

def load_ifc_data(ifc_file):
    """
    Loads all elements of type 'IfcElement' from the IFC file.

    Args:
        ifc_file: The opened IFC file object.

    Returns:
        elements: A list of all building elements in the IFC file.

    Exits:
        If no building elements are found, the script exits with an error message.
    """
    elements = ifc_file.by_type("IfcElement")
    if not elements:
        print("No building elements found in the IFC file.", file=sys.stderr)
        sys.exit(1)
    return elements

def get_layer_volumes_and_materials(ifc_file, element, total_volume):
    """
    Extracts volumes and names of material layers for a given building element.

    This function considers both simple material layer sets and constituent sets,
    adapting to the IFC schema version.

    Args:
        ifc_file: The IFC file object opened with ifcopenshell.
        element: The building element (IfcElement) to process.
        total_volume: The total volume of the element, used to calculate layer volumes.

    Returns:
        Tuple[List[float], List[str]]: A tuple containing two lists:
            - material_layers_volumes: The volumes of each material layer.
            - material_layers_names: The names of each material layer.
    """
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
    """
    Calculates the volume of a given shape using Open CASCADE technology.

    Args:
        shape: The geometric shape object.

    Returns:
        volume (float): The calculated volume of the shape.
    """
    prop = GProp_GProps()
    brepgprop_VolumeProperties(shape.geometry, prop)
    return prop.Mass()

def process_element(ifc_file, element, settings, ifc_file_path, user_id, session_id):
    """
    Processes a single building element to extract detailed data and metadata, 
    including handling of multilayer materials.

    Args:
        ifc_file: The opened IFC file object.
        element: The building element to process.
        settings: Geometry settings for shape creation.
        ifc_file_path: Path of the IFC file being processed.
        user_id: Identifier for the user who uploaded the file.
        session_id: Identifier for the upload session.

    Returns:
        element_data (dict): Extracted data and metadata for the element, 
                             including structured multilayer material information.
    """
    try:
        shape = geom.create_shape(settings, element)
        volume = calculate_volume(shape)
    except Exception as e:
        print(f"Error processing element {element.GlobalId}: {e}", file=sys.stderr)
        return None

    material_layers_volumes, material_layers_names = get_layer_volumes_and_materials(ifc_file, element, volume)

    # Initialize materials_info
    materials_info = []
    
    if material_layers_names:
        materials_info = [{
            "name": name,
            "volume": volume
        } for name, volume in zip(material_layers_names, material_layers_volumes)]
    elif volume > 0:
        # Here, you try to get the material name directly for elements with a single material
        material_name, is_multilayer = "Unnamed Material", False  # Default values
        materials = ifcopenshell.util.element.get_materials(element, should_inherit=True)
        if materials:
            material_name = materials[0].Name if materials[0].Name else "Unnamed Material"
            is_multilayer = len(materials) > 1
        materials_info.append({"name": material_name, "volume": volume})

    is_multilayer = len(materials_info) > 1

    element_data = {
        "guid": element.GlobalId,
        "instance_name": element.Name if element.Name else "Unnamed",
        "ifc_class": element.is_a(),
        "materials_info": materials_info,
        "total_volume": volume,
        "is_multilayer": is_multilayer,
        "ifc_file_origin": ifc_file_path,
        "user_id": user_id,
        "session_id": session_id
    }
  
    return element_data


def main(file_path):
def main(file_path, project_id):
    # Connect to the MongoDB instance with the specified database
    client = pymongo.MongoClient("mongodb://localhost:27017/IfcLCAdata_01")
    # Access or create the database and collection
    db = client["IfcLCAdata_01"]
    collection = db["building_elements"]

    ifc_file = open_ifc_file(file_path)
    settings = geom.settings()
    settings.set(settings.USE_PYTHON_OPENCASCADE, True)

    # Example values for demonstration
    user_id = "example_user_id"
    session_id = "example_session_id"  # This should be updated to fetch the latest session ID for the project

    elements = load_ifc_data(ifc_file)

    total_volume = 0  # Initialize total volume accumulator

    for element in elements:
        element_data = process_element(ifc_file, element, settings, file_path, user_id, session_id, project_id)
        if element_data:
            # Add the volume of the current element to the total volume
            total_volume += element_data['total_volume']
            # Insert the processed element data into the collection
            collection.insert_one(element_data)

    
    # Print the total volume after processing all elements
    print(total_volume)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_ifc_file> <project_id>", file=sys.stderr)
        sys.exit(1)

    file_path, project_id = sys.argv[1], sys.argv[2]
    main(file_path, project_id)
