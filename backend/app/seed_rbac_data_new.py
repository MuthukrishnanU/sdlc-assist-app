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

collection_name = "sdlcUsersNew"

# Clear existing sdlcUsersNew collection if it exists
print(f"Clearing existing entries in '{collection_name}'...")
db[collection_name].delete_many({})

roles = [
    {
        "name": "Business Analyst",
        "prefix": "ba",
        "domains": ["Retail Banking", "Healthcare", "Digital Channels"],
        "canView": "sdlc"
    },
    {
        "name": "Data Engineer",
        "prefix": "de",
        "domains": ["Data Engineering", "Lending", "Collections"],
        "canView": "sdlc"
    },
    {
        "name": "Data Scientist",
        "prefix": "ds",
        "domains": ["Cards", "Media", "Data Engineering"],
        "canView": "both"
    },
    {
        "name": "Lead",
        "prefix": "lead",
        "domains": ["Retail Banking", "Lending", "Collections"],
        "canView": "both"
    },
    {
        "name": "Project Lead",
        "prefix": "pl",
        "domains": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"],
        "canView": "cbi"
    },
    {
        "name": "Vertical Lead",
        "prefix": "vl",
        "domains": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"],
        "canView": "cbi"
    }
]

users_bulk = []

# 1. Add admin user
admin_user = {
    "userId": "admin",
    "password": "admin",
    "domain": "admin",
    "role": "admin",
    "canView": "both"
}
users_bulk.append(InsertOne(admin_user))

# 2. Add 99 other users
role_counters = {r["name"]: 0 for r in roles}

for i in range(99):
    role_info = roles[i % len(roles)]
    role_name = role_info["name"]
    role_counters[role_name] += 1
    num = role_counters[role_name]
    
    prefix = role_info["prefix"]
    domain_list = role_info["domains"]
    domain = domain_list[(num - 1) % len(domain_list)]
    
    user_doc = {
        "userId": f"{prefix}_user_{num}",
        "password": f"{prefix}pass{num}",
        "domain": domain,
        "role": role_name,
        "canView": role_info["canView"]
    }
    users_bulk.append(InsertOne(user_doc))

if users_bulk:
    print(f"Inserting {len(users_bulk)} records into '{collection_name}'...")
    db[collection_name].bulk_write(users_bulk)
    print(f"[OK] Seeded '{collection_name}' successfully.")
else:
    print("No users to seed.")

# Configure unique index on userId field
print(f"Creating unique index on '{collection_name}' for 'userId' field...")
db[collection_name].create_index("userId", unique=True)
print("[OK] Index configured successfully.")

print("\nSeeding of 'sdlcUsersNew' complete!")
