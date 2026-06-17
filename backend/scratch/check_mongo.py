import pymongo
import os
from dotenv import load_dotenv

load_dotenv()

mongodb_uri = os.getenv("MONGODB_URI")
client = pymongo.MongoClient(mongodb_uri)
db = client['bankingSdlcDB']

print("Collections:")
print(db.list_collection_names())

# Check recent entries in roleTokenConsumption
print("\nRecent roleTokenConsumption:")
for doc in db["roleTokenConsumption"].find().sort("_id", -1).limit(5):
    print(doc)

# Check piiForGuardrails entries
print("\npiiForGuardrails:")
for doc in db["piiForGuardrails"].find():
    print(doc)

# Check modelQuotas entries
print("\nmodelQuotas:")
for doc in db["modelQuotas"].find():
    print(doc)

# Check sdlcUsersNew entries
print("\nsdlcUsersNew:")
for doc in db["sdlcUsersNew"].find().limit(10):
    print(doc)


