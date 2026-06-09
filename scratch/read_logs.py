import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["bankingSdlcDB"]

print("\n--- pushAllDetails content ---")
pushes = list(db["pushAllDetails"].find().sort("timestamp", -1).limit(5))
for i, push in enumerate(pushes):
    print(f"\n================ Push {i} ================")
    print(f"Timestamp: {push.get('timestamp')}")
    print(f"User ID: {push.get('userId')}")
    print(f"Role: {push.get('role')}")
    print(f"Input Fields: {push.get('inputFields')}")
    print(f"Code Output:\n{push.get('codeOutput')}")
    print("=========================================\n")
