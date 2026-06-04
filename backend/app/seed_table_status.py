import os
import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient, InsertOne
from dotenv import load_dotenv

# Load env variables from backend/.env relative to this file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

collection_name = "tableStatus"
# Define mappings for createdUserId
de_tables = {"customerDetails", "accountBalances", "loanInfo", "transactionsInfo", "dataQualityLogs"}
hc_tables = {"patientsInfo", "medicalRecords", "doctorDetails", "hospitalBeds", "healthcareDqLogs"}
media_tables = {"subscriberProfiles", "contentLibrary", "watchHistory", "billingTransactions", "mediaDqLogs"}

# Clear existing tableStatus collection if it exists
print(f"Clearing existing entries in '{collection_name}'...")
db[collection_name].delete_many({})

# Get all collections in bankingSdlcDB dynamically
all_cols = db.list_collection_names()
print(f"Discovered collections in DB: {all_cols}")

# Target tables are all collections EXCEPT 'tableStatus' and 'semanticMetaStore'
target_tables = [col for col in all_cols if col not in (collection_name, "semanticMetaStore")]
print(f"Tables to seed status for: {target_tables}")

# Define IST timezone (UTC + 5:30)
ist_tz = timezone(timedelta(hours=5, minutes=30))

bulk_docs = []
for table in target_tables:
    # 1. Determine createdUserId
    if table in de_tables:
        user_id = "de_user_1"
        role = "Data Engineering"
    elif table in hc_tables:
        user_id = "hc_user_1"
        role = "Healthcare"
    elif table in media_tables:
        user_id = "media_user_1"
        role = "Media"
    else:
        user_id = "system" # Default user for administrative/system tables
        role = "system"
        
    # 2. Generate random createdTimestamp in the last 30 days
    now_ist = datetime.now(ist_tz)
    random_days = random.randint(0, 29)
    random_seconds = random.randint(0, 86400)
    created_dt = now_ist - timedelta(days=random_days, seconds=random_seconds)
    
    # 3. Calculate approvalTimestamp (exactly 1 hour after createdTimestamp)
    approval_dt = created_dt + timedelta(hours=1)
    
    # 4. Format timestamps as DD-MM-YYYY-hh-mm-ss IST
    created_str = created_dt.strftime("%d-%m-%Y-%H-%M-%S") + " IST"
    approval_str = approval_dt.strftime("%d-%m-%Y-%H-%M-%S") + " IST"
    
    doc = {
        "tableName": table,
        "approvalStatus": "approved",
        "createdUserId": user_id,
        "createdTimestamp": created_str,
        "approvalTimestamp": approval_str,
        "tableRole": role,
        "tableSchema": ""
    }
    bulk_docs.append(InsertOne(doc))

if bulk_docs:
    print(f"Inserting {len(bulk_docs)} records into '{collection_name}'...")
    db[collection_name].bulk_write(bulk_docs)
    print(f"[OK] Seeded '{collection_name}' successfully.")
else:
    print("No tables found to seed.")

# Configure unique index on tableName field
print(f"Creating unique index on '{collection_name}' for 'tableName' field...")
db[collection_name].create_index("tableName", unique=True)
print("[OK] Index configured successfully.")

print("\nSeeding of 'tableStatus' complete!")
