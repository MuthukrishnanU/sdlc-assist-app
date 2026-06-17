import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")
CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]
col = db["piiForGuardrails"]

defaults = [
    {"piiParameter": "salary", "piiReason": "Confidential financial salary info"},
    {"piiParameter": "credit card number", "piiReason": "Sensitive credit card data"},
    {"piiParameter": "account number", "piiReason": "Private account numbers"},
    {"piiParameter": "aadhaar", "piiReason": "National identity identifier"}
]

for d in defaults:
    col.update_one(
        {"piiParameter": d["piiParameter"]},
        {"$setOnInsert": d},
        upsert=True
    )

print(f"PII parameters seeded. Total count: {col.count_documents({})}")
