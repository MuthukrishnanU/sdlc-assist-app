import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")
mongo_uri = os.getenv("MONGODB_URI")
if not mongo_uri:
    print("No MongoDB URI configured.")
else:
    client = MongoClient(mongo_uri)
    db = client["bankingSdlcDB"]
    print("Admin details:")
    print(db["sdlcUsersNew"].find_one({"userId": "admin"}))
