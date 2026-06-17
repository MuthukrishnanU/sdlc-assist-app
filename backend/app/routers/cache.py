from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..config.settings import get_db
from ..services.embeddings import get_embedding

router = APIRouter(tags=["Semantic Cache"])

class CacheStoreRequest(BaseModel):
    query: str
    format: str
    tables: List[str]
    columns: List[str]
    code: str
    userId: Optional[str] = None

@router.post("/cache/store")
async def store_cache_entry(request: CacheStoreRequest):
    try:
        db = get_db()
        
        # Calculate embedding
        embedding = await get_embedding(request.query)
        
        # Check if identical query already exists in Cache to avoid duplicates
        existing = db["Semantic_Cache"].find_one({"query": request.query, "format": request.format})
        
        cache_doc = {
            "query": request.query,
            "format": request.format,
            "tables": request.tables,
            "columns": request.columns,
            "code": request.code,
            "embedding": embedding,
            "userId": request.userId or "unknown",
            "created_at": datetime.now()
        }
        
        if existing:
            db["Semantic_Cache"].update_one(
                {"_id": existing["_id"]},
                {"$set": cache_doc}
            )
            message = "Semantic Cache entry updated successfully."
        else:
            db["Semantic_Cache"].insert_one(cache_doc)
            message = "Semantic Cache entry stored successfully."
            
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cache/entries")
async def get_cache_entries():
    try:
        db = get_db()
        cursor = db["Semantic_Cache"].find()
        entries = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "embedding" in doc:
                doc["has_embedding"] = doc["embedding"] is not None
                del doc["embedding"]
            entries.append(doc)
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cache/hits")
async def get_cache_hits():
    try:
        db = get_db()
        cursor = db["Semantic_Cache_Hits"].find()
        hits = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            hits.append(doc)
        return hits
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
