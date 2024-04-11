import pandas as pd
from pymongo import MongoClient

def enrich_with_group_info_and_insert_to_mongodb(csv_file_path, db_name, collection_name):
    # Establish a connection to the MongoDB instance
    client = MongoClient('mongodb://localhost:27017/')
    db = client[db_name]
    collection = db[collection_name]

    try:
        # Ensure proper handling of different types of bad lines, and potentially adjust the encoding if necessary
        df = pd.read_csv(csv_file_path, encoding='ISO-8859-1', on_bad_lines='skip')
    except pd.errors.ParserError as e:
        print(f"Error reading CSV file: {e}")
        return

    current_group_info = {}

    for index, row in df.iterrows():
        identifier = row.iloc[0]  # Assuming the first column is used for identification
        
        try:
            # This tries to convert the identifier to an integer, useful for checking if it's an integer
            int_identifier = int(identifier)
            is_integer = True
        except ValueError:
            is_integer = False

        # If identifier is not NaN and is an integer, then it's assumed to be a group identifier
        if pd.notna(identifier) and is_integer:
            current_group_info = {
                "groupNumber": str(int_identifier),
                "groupName": row[2]  # Assuming the third column represents the group name
            }
        else:
            # Convert the row to a dictionary, filtering out NaN values
            member_data = {k: v for k, v in row.dropna().to_dict().items()}
            # Update the member data with the current group information
            member_data.update(current_group_info)
            # Insert the enriched document into MongoDB
            collection.insert_one(member_data)

    print(f"Data successfully inserted into {db_name}.{collection_name}")

csv_file_path = r"C:\\Users\\LouisTrümpler\\Documents\\GitHub\\IfcLCA\\data\\Oekobilanzdaten_ Baubereich_Donne_ecobilans_construction_2009-1-2022_v4_0.csv"
db_name = "IfcLCAdata_01"
collection_name = "carbon_data_KBOB"

enrich_with_group_info_and_insert_to_mongodb(csv_file_path, db_name, collection_name)
