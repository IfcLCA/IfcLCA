#!/opt/miniconda3/bin/python

import sys
import ifcopenshell
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

def export_to_ifc(project_id, output_path):
    # Connect to MongoDB
    client = MongoClient(os.getenv('DATABASE_URL'))
    db = client['IfcLCAdata_01']
    
    # Fetch project data
    project = db.projects.find_one({'_id': ObjectId(project_id)})
    if not project:
        print("Project not found")
        return

    # Fetch the original IFC file path
    original_ifc_path = project.get('ifc_file_path')
    if not original_ifc_path or not os.path.exists(original_ifc_path):
        print("Original IFC file not found")
        return

    # Load the original IFC file
    ifc_file = ifcopenshell.open(original_ifc_path)

    # Fetch building elements
    elements = db.building_elements.find({'projectId': ObjectId(project_id)})

    for element in elements:
        # Find the corresponding IFC element
        ifc_element = ifc_file.by_guid(element['guid'])
        if ifc_element:
            # Create a property set for this element
            pset_name = "Pset_IfcLCA_Results"
            pset = ifc_file.createIfcPropertySet(
                ifcopenshell.guid.new(),
                None, pset_name, None, []
            )

            # Aggregate total CO2 per material name
            materials = element.get('materials_info', [])
            material_totals = {}
            for material in materials:
                name = material['name']
                co2 = float(material.get('total_co2', 0))
                material_totals[name] = material_totals.get(name, 0) + co2

            properties = []
            for material_name, total_co2 in material_totals.items():
                prop_name = f"Material_{material_name}_CO2"
                prop = ifc_file.createIfcPropertySingleValue(
                    prop_name, None, 
                    ifc_file.create_entity("IfcReal", total_co2), None
                )
                properties.append(prop)

            # Add total CO2 for the element
            total_co2 = sum(material_totals.values())
            total_co2_prop = ifc_file.createIfcPropertySingleValue(
                "Total_CO2", None, 
                ifc_file.create_entity("IfcReal", total_co2), None
            )
            properties.append(total_co2_prop)

            # Assign properties to the property set
            pset.HasProperties = properties

            # Assign the property set to the element
            ifc_file.createIfcRelDefinesByProperties(
                ifcopenshell.guid.new(),
                None, None,
                None, [ifc_element],
                pset
            )

    # Write the updated IFC file
    ifc_file.write(output_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python export_ifc.py <project_id> <output_path>")
        sys.exit(1)

    project_id = sys.argv[1]
    output_path = sys.argv[2]
    export_to_ifc(project_id, output_path)