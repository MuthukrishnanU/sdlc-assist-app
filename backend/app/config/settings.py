import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv(override=True)

MONGODB_URI = os.getenv("MONGODB_URI")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MISTRALAI_API_KEY = os.getenv("MISTRALAI_API_KEY")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")

# Database client setup
if not MONGODB_URI:
    raise ValueError("MONGODB_URI is not set in environment variables")

client = MongoClient(MONGODB_URI)
db = client["bankingSdlcDB"]

def get_db():
    return db
