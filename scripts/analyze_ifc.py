import sys
import ifcopenshell

def count_elements_in_ifc(file_path):
    try:
        model = ifcopenshell.open(file_path)
        products = model.by_type('IfcProduct')
        return len(products)
    except Exception as e:
        print(f"Error counting elements in IFC file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python analyze_ifc.py <path_to_ifc_file>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    count = count_elements_in_ifc(file_path)
    print(count)  # Output the count to capture it in the Node.js application