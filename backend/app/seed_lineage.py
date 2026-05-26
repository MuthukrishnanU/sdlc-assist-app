import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

print("Adding column lineage to semanticMetaStore collection...")

cursor = db['semanticMetaStore'].find()
updated_count = 0

for doc in cursor:
    col_name = doc["collection_name"]
    fields = doc.get("fields", [])
    
    updated_fields = []
    for field in fields:
        field_name = field["field_name"]
        
        # Define realistic lineage mapping
        source_tables = [col_name]
        source_columns = [field_name]
        
        if field_name == "customer_id" and col_name in ["accountBalances", "loanInfo", "transactionsInfo"]:
            transformation = f"Foreign Key link mapping: Reference to customerDetails.customer_id"
        elif field_name == "account_id" and col_name == "transactionsInfo":
            transformation = f"Foreign Key link mapping: Reference to accountBalances.account_id"
        elif field_name == "remaining_balance":
            transformation = "Calculated field: Derived from loan principal, tenure, and payment logs"
        elif field_name == "available_balance":
            transformation = "Calculated field: current_balance minus funds on hold / block checks"
        else:
            transformation = f"Direct data ingest copy from source {col_name}.{field_name}"
            
        field["lineage"] = {
            "source_tables": source_tables,
            "source_columns": source_columns,
            "transformation": transformation
        }
        updated_fields.append(field)
        
    db['semanticMetaStore'].update_one(
        {"_id": doc["_id"]},
        {"$set": {"fields": updated_fields}}
    )
    print(f"[OK] Seeded lineage details for collection: {col_name}")
    updated_count += 1

print(f"\nCompleted! Lineage information added to {updated_count} collections in semanticMetaStore.")
