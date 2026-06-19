import os
import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient, InsertOne
from faker import Faker
from dotenv import load_dotenv

# Load env variables from backend/.env relative to this file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

fake = Faker()
CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

target_col = "transactionsInfoNew"
source_col = "transactionsInfo"

print(f"Checking existing '{source_col}' collection...")
if source_col not in db.list_collection_names():
    print(f"Error: Source collection '{source_col}' does not exist in database.")
    exit(1)

# 1. Fetch existing records from transactionsInfo
print(f"Retrieving existing records from '{source_col}'...")
original_txns = list(db[source_col].find())
num_original = len(original_txns)
print(f"Found {num_original} original records.")

# We will construct a new list of documents for insertion
new_docs = []
for doc in original_txns:
    # Remove MongoDB internal _id field to allow insert into the new collection
    doc.pop("_id", None)
    new_docs.append(doc)

# 2. Get existing customer_ids and account_ids to ensure referential integrity
print("Fetching customerDetails and accountBalances to reference in new transactions...")
customer_ids = db["customerDetails"].distinct("customer_id")
account_ids = db["accountBalances"].distinct("account_id")

if not customer_ids or not account_ids:
    # Fallback to lists from original transactions if tables are empty
    print("Warning: customerDetails or accountBalances collections are empty. Falling back to IDs from original transactions.")
    customer_ids = list(set([doc["customer_id"] for doc in new_docs]))
    account_ids = list(set([doc["account_id"] for doc in new_docs]))

# 3. Determine transaction ID sequence counter starting point
max_id_num = 701500  # Default starting point if parse fails
if new_docs:
    try:
        id_nums = []
        for doc in new_docs:
            tx_id = doc.get("transaction_id", "")
            if tx_id.startswith("TXN-"):
                id_nums.append(int(tx_id.split("-")[1]))
        if id_nums:
            max_id_num = max(id_nums) + 1
    except Exception as e:
        print(f"Warning parsing transaction IDs: {e}. Using default start counter: {max_id_num}")

# 4. Generate 1000 new transactions varying from October 2025 to March 2026
print("Generating 1000 new transaction records (Oct 2025 - Mar 2026)...")
start_date = datetime(2025, 10, 1, 0, 0, 0)
end_date = datetime(2026, 3, 31, 23, 59, 59)
date_delta = end_date - start_date
total_seconds = int(date_delta.total_seconds())

for i in range(1000):
    tx_id_num = max_id_num + i
    random_seconds = random.randint(0, total_seconds)
    random_microseconds = random.randint(0, 999999)
    ts = start_date + timedelta(seconds=random_seconds, microseconds=random_microseconds)
    
    doc = {
        "transaction_id": f"TXN-{tx_id_num}",
        "account_id": random.choice(account_ids),
        "customer_id": random.choice(customer_ids),
        "amount": round(random.uniform(10.0, 50000.0), 2),
        "transaction_type": random.choice(["Credit", "Debit", "Debit"]),
        "channel": random.choice(["UPI", "NetBanking", "ATM", "POS"]),
        "timestamp": ts,
        "merchant_name": fake.company(),
        "status": random.choice(["Success", "Success", "Success", "Failed", "Flagged"])
    }
    new_docs.append(doc)

# 5. Clear existing transactionsInfoNew collection if it exists and write the new set
print(f"Clearing existing entries in '{target_col}'...")
db[target_col].delete_many({})

print(f"Writing {len(new_docs)} records into '{target_col}'...")
db[target_col].bulk_write([InsertOne(doc) for doc in new_docs])
print(f"[OK] Successfully seeded '{target_col}' with {len(new_docs)} documents.")

# Create unique index on transaction_id
print(f"Creating unique index on '{target_col}' for 'transaction_id' field...")
db[target_col].create_index("transaction_id", unique=True)
print("[OK] Index configured successfully.")

# 6. Clone metadata for transactionsInfoNew
print("Cloning metadata for the new table/collection...")

# 6.1 semanticMetaStore clone
meta_doc = db["semanticMetaStore"].find_one({"collection_name": source_col})
if meta_doc:
    meta_doc.pop("_id", None)
    meta_doc["collection_name"] = target_col
    meta_doc["friendly_name"] = "Transactions Log New"
    meta_doc["description"] = "Log of individual account transactions containing amount, type, execution channel, timestamp, and merchant name. Extends back to October 2025."
    
    # Update lineage info for fields
    fields = meta_doc.get("fields", [])
    updated_fields = []
    for field in fields:
        field_name = field["field_name"]
        
        # Determine lineage mapping
        source_tables = [target_col]
        source_columns = [field_name]
        
        if field_name == "customer_id":
            transformation = "Foreign Key link mapping: Reference to customerDetails.customer_id"
        elif field_name == "account_id":
            transformation = "Foreign Key link mapping: Reference to accountBalances.account_id"
        else:
            transformation = f"Direct data ingest copy from source {target_col}.{field_name}"
            
        field["lineage"] = {
            "source_tables": source_tables,
            "source_columns": source_columns,
            "transformation": transformation
        }
        updated_fields.append(field)
    
    meta_doc["fields"] = updated_fields
    
    # Delete old metadata for target_col if it exists and write new one
    db["semanticMetaStore"].delete_many({"collection_name": target_col})
    db["semanticMetaStore"].insert_one(meta_doc)
    print("[OK] Seeded semanticMetaStore entry for transactionsInfoNew successfully.")
else:
    print(f"Warning: No metadata found for '{source_col}' in semanticMetaStore.")

# 6.2 tableStatus clone
status_doc = db["tableStatus"].find_one({"tableName": source_col})
if status_doc:
    status_doc.pop("_id", None)
    status_doc["tableName"] = target_col
    db["tableStatus"].delete_many({"tableName": target_col})
    db["tableStatus"].insert_one(status_doc)
    print("[OK] Seeded tableStatus entry for transactionsInfoNew successfully.")
else:
    print(f"Warning: No tableStatus entry found for '{source_col}'.")

# 6.3 tableStatusNew clone
status_new_doc = db["tableStatusNew"].find_one({"tableName": source_col})
if status_new_doc:
    status_new_doc.pop("_id", None)
    status_new_doc["tableName"] = target_col
    db["tableStatusNew"].delete_many({"tableName": target_col})
    db["tableStatusNew"].insert_one(status_new_doc)
    print("[OK] Seeded tableStatusNew entry for transactionsInfoNew successfully.")
else:
    print(f"Warning: No tableStatusNew entry found for '{source_col}'.")

print("\nSeeding of 'transactionsInfoNew' completed successfully!")
