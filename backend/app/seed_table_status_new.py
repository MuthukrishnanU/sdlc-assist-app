import os
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

collection_name = "tableStatusNew"

# Clear existing tableStatusNew collection if it exists
print(f"Clearing existing entries in '{collection_name}'...")
db[collection_name].delete_many({})

# Mappings for domain and tableType
table_mappings = {
    # Data Engineering / Banking tables (SDLC)
    "customerDetails": {"domain": "Retail Banking", "tableType": "sdlc"},
    "accountBalances": {"domain": "Retail Banking", "tableType": "sdlc"},
    "loanInfo": {"domain": "Lending", "tableType": "sdlc"},
    "transactionsInfo": {"domain": "Cards", "tableType": "sdlc"},
    "dataQualityLogs": {"domain": "Data Engineering", "tableType": "sdlc"},
    
    # Healthcare tables (CBI)
    "patientsInfo": {"domain": "Healthcare", "tableType": "cbi"},
    "medicalRecords": {"domain": "Healthcare", "tableType": "cbi"},
    "doctorDetails": {"domain": "Healthcare", "tableType": "cbi"},
    "hospitalBeds": {"domain": "Healthcare", "tableType": "cbi"},
    "healthcareDqLogs": {"domain": "Healthcare", "tableType": "cbi"},
    
    # Media tables (CBI)
    "subscriberProfiles": {"domain": "Media", "tableType": "cbi"},
    "contentLibrary": {"domain": "Media", "tableType": "cbi"},
    "watchHistory": {"domain": "Media", "tableType": "cbi"},
    "billingTransactions": {"domain": "Media", "tableType": "cbi"},
    "mediaDqLogs": {"domain": "Media", "tableType": "cbi"}
}

# Fetch all docs from the original tableStatus
original_docs = list(db["tableStatus"].find({}))
print(f"Found {len(original_docs)} original documents in 'tableStatus'.")

bulk_docs = []
for doc in original_docs:
    # Remove _id to allow insert as a new document
    doc.pop("_id", None)
    
    table_name = doc.get("tableName")
    mapping = table_mappings.get(table_name)
    
    if mapping:
        doc["domain"] = mapping["domain"]
        doc["tableType"] = mapping["tableType"]
    else:
        # Default or custom created tables
        doc["domain"] = doc.get("tableRole", "system")
        # Check if tableRole suggests Healthcare/Media -> cbi, else sdlc
        role_lower = str(doc.get("tableRole", "")).lower()
        if "healthcare" in role_lower or "media" in role_lower:
            doc["tableType"] = "cbi"
        else:
            doc["tableType"] = "sdlc"
            
    bulk_docs.append(InsertOne(doc))

if bulk_docs:
    print(f"Inserting {len(bulk_docs)} records into '{collection_name}'...")
    db[collection_name].bulk_write(bulk_docs)
    print(f"[OK] Seeded '{collection_name}' successfully.")
else:
    print("No original records found in 'tableStatus' to clone.")

# Configure unique index on tableName field
print(f"Creating unique index on '{collection_name}' for 'tableName' field...")
db[collection_name].create_index("tableName", unique=True)
print("[OK] Index configured successfully.")

print("\nSeeding of 'tableStatusNew' complete!")
