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
    print("--- sdlcUsersNew ---")
    for user in db["sdlcUsersNew"].find():
        print(user)
    print("--- sdlcUsersTemp ---")
    for user in db["sdlcUsersTemp"].find():
        print(user)
