#!/usr/bin/env python

import sys
import json
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.shape
from ifcopenshell.util.unit import calculate_unit_scale
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

# Initialize ThreadPoolExecutor globally for concurrent shape creation
executor = ThreadPoolExecutor(max_workers=multiprocessing.cpu_count())

def open_ifc_file(file_path):
    try:
        return ifcopenshell.open(file_path)
    except Exception as e:
        print(json.dumps({"error": f"Error opening IFC file: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

def get_volume_from_basequantities(element):
    for rel_def in element.IsDefinedBy:
        if rel_def.is_a("IfcRelDefinesByProperties"):
            prop_set = rel_def.RelatingPropertyDefinition
            if prop_set.is_a("IfcElementQuantity"):
                for quantity in prop_set.Quantities:
                    if quantity.is_a("IfcQuantityVolume"):
                        try:
                            return float(quantity.VolumeValue)
                        except (ValueError, AttributeError):
                            continue
    return None

def get_volume_from_properties(element):
    volume = get_volume_from_basequantities(element)
    if volume is not None:
        return volume

    for rel in element.IsDefinedBy:
        if rel.is_a('IfcRelDefinesByProperties'):
            pset = rel.RelatingPropertyDefinition
            if pset.is_a('IfcPropertySet'):
                for prop in pset.HasProperties:
                    if prop.Name in ["NetVolume", "GrossVolume"]:
                        try:
                            return float(prop.NominalValue.wrappedValue)
                        except (ValueError, AttributeError):
                            continue
    return None

def get_building_storey(element):
    for rel in element.ContainedInStructure:
        if rel.is_a('IfcRelContainedInSpatialStructure'):
            if rel.RelatingStructure.is_a('IfcBuildingStorey'):
                return rel.RelatingStructure.Name
    return None

def get_material_layers(element, total_volume):
    materials = []
    
    if element.HasAssociations:
        for association in element.HasAssociations:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial
                
                if material.is_a('IfcMaterialLayerSetUsage'):
                    layer_set = material.ForLayerSet
                    total_thickness = sum(layer.LayerThickness for layer in layer_set.MaterialLayers)
                    
                    for layer in layer_set.MaterialLayers:
                        fraction = layer.LayerThickness / total_thickness if total_thickness else 1
                        volume = total_volume * fraction if total_volume else 0
                        materials.append({
                            "name": layer.Material.Name if layer.Material else "Unknown",
                            "volume": round(volume, 3),
                            "fraction": round(fraction, 3)
                        })
                else:
                    # Single material
                    material_name = material.Name if hasattr(material, 'Name') else "Unknown"
                    materials.append({
                        "name": material_name,
                        "volume": round(total_volume, 3) if total_volume else 0,
                        "fraction": 1.0
                    })
    
    return materials

def process_element(element):
    volume = get_volume_from_properties(element)
    materials = get_material_layers(element, volume)
    
    return {
        "guid": element.GlobalId,
        "name": element.Name if element.Name else "Unnamed",
        "type": element.is_a(),
        "materials": materials,
        "volume": volume if volume else 0,
        "buildingStorey": get_building_storey(element)
    }

def main(file_path):
    try:
        ifc_file = open_ifc_file(file_path)
        unit_scale = calculate_unit_scale(ifc_file)
        
        elements = []
        for element in ifc_file.by_type("IfcElement"):
            try:
                processed = process_element(element)
                elements.append(processed)
            except Exception as e:
                print(json.dumps({"error": f"Error processing element {element.GlobalId}: {str(e)}"}), 
                      file=sys.stderr)
                continue
        
        # Output the results as JSON
        print(json.dumps({"elements": elements}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python process_ifc.py <path_to_ifc_file>"}), 
              file=sys.stderr)
        sys.exit(1)
    
    main(sys.argv[1]) 