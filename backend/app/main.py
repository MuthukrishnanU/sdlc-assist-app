from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import CodeGenerationRequest, CodeGenerationResponse
from .generator import generator
import uvicorn
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

app = FastAPI(title="SDLC Assist API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "SDLC Assist API is running"}

@app.get("/metadata")
async def get_metadata():
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]
        collections = db.list_collection_names()
        
        metadata = {}
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            doc = db[col_name].find_one()
            if doc:
                # Extract fields and ignore MongoDB internal '_id' field
                fields = [key for key in doc.keys() if key != '_id']
                metadata[col_name] = fields
            else:
                metadata[col_name] = []
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=CodeGenerationResponse)
async def generate_code(request: CodeGenerationRequest):
    try:
        result = await generator.generate(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
