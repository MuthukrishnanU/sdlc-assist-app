import os
from pymongo import MongoClient, UpdateOne
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

collection_name = "sdlcUsersNew"

# Verify collection has entries
total_users = db[collection_name].count_documents({})
print(f"Found {total_users} users in '{collection_name}' collection.")

domain_array_mapping = {
    "admin": ["admin"],
    "Business Analyst": ["Retail Banking", "Healthcare", "Digital Channels"],
    "Data Engineer": ["Data Engineering", "Lending", "Collections"],
    "Data Scientist": ["Cards", "Media", "Data Engineering"],
    "Lead": ["Retail Banking", "Lending", "Collections"],
    "Project Lead": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"],
    "Vertical Lead": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"]
}

# Fetch all users
users = list(db[collection_name].find({}))

bulk_updates = []
for user in users:
    role = user.get("role")
    user_id = user.get("userId")
    
    # Determine domain array
    domains = domain_array_mapping.get(role)
    
    # Fallback to check admin by userId
    if not domains and user_id == "admin":
        domains = domain_array_mapping.get("admin")
        
    if domains is not None:
        bulk_updates.append(UpdateOne(
            {"_id": user["_id"]},
            {"$set": {"domain": domains}}
        ))
    else:
        print(f"Warning: No domain mapping found for user {user_id} with role {role}")

if bulk_updates:
    print(f"Updating {len(bulk_updates)} users in '{collection_name}'...")
    result = db[collection_name].bulk_write(bulk_updates)
    print(f"[OK] Successfully updated 'domain' field for users in '{collection_name}'. Matched: {result.matched_count}, Modified: {result.modified_count}")
else:
    print("No users needed updates.")
