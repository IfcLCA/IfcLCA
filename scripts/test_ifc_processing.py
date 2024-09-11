import unittest
import ifcopenshell
from analyze_ifc import open_ifc_file, process_element
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class TestIfcProcessing(unittest.IsolatedAsyncioTestCase):

    @classmethod
    def setUpClass(cls):
        # Directory containing test IFC files
        cls.test_dir = 'testfiles'
        cls.ifc_files = [os.path.join(cls.test_dir, file) for file in os.listdir(cls.test_dir) if file.endswith('.ifc')]

    async def test_process_elements(self):
        user_id = "test_user"
        session_id = "test_session"
        projectId = "test_project"
        
        for ifc_file_path in self.ifc_files:
            with self.subTest(ifc_file=ifc_file_path):
                logging.info(f"\n---\nProcessing elements in file: {os.path.basename(ifc_file_path)}")
                ifc_file = open_ifc_file(ifc_file_path)

                # Load IFC elements directly
                elements = ifc_file.by_type("IfcElement")

                for i, element in enumerate(elements[:5]):  # Limiting to the first 5 elements for brevity
                    element_data = await process_element(ifc_file, element, None, ifc_file_path, user_id, session_id, projectId)
                    if element_data is None:
                        logging.error(f"Failed to process element {element.GlobalId} in {os.path.basename(ifc_file_path)}")
                        self.fail(f"Element {element.GlobalId} could not be processed")

                    # Assertions to verify the element data structure
                    self.assertIsInstance(element_data, dict)
                    self.assertIn('guid', element_data)
                    self.assertIn('materials_info', element_data)
                    self.assertIsInstance(element_data['materials_info'], list)

                    # Additional assertions for `IsExternal` and `LoadBearing`
                    self.assertIn('is_external', element_data)
                    self.assertIn('is_loadbearing', element_data)

                    # Logging the details of the processed element
                    logging.info(f"Element {element.GlobalId} in {os.path.basename(ifc_file_path)}")

                    # Logging and asserting material details
                    for material in element_data['materials_info']:
                        self.assertIn('name', material)
                        self.assertIn('volume', material)
                        if material['name'] == "Unnamed Material":
                            logging.error(f"Unnamed material found in element {element.GlobalId} in {os.path.basename(ifc_file_path)}")
                            self.fail(f"Unnamed material in element {element.GlobalId}")
                        logging.info(f"  Material: {material['name']}, Volume: {material['volume']}")

                    # Log and assert `is_external` and `is_loadbearing`
                    logging.info(f"  IsExternal: {element_data['is_external']}, LoadBearing: {element_data['is_loadbearing']}")
                    self.assertIsNotNone(element_data['is_external'], "IsExternal property should not be None")
                    self.assertIsNotNone(element_data['is_loadbearing'], "LoadBearing property should not be None")

if __name__ == '__main__':
    unittest.main()
