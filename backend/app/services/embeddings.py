import os
from openai import AsyncOpenAI
from difflib import SequenceMatcher

async def get_embedding(text: str) -> list:
    """
    Retrieves the embedding vector for the text using OpenAI API.
    Returns None if the API key is not configured or on failure.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"[Embedding Error] Failed to get OpenAI embedding: {e}")
        return None

def cosine_similarity(v1: list, v2: list) -> float:
    """
    Computes cosine similarity between two vectors.
    """
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_a = sum(x * x for x in v1) ** 0.5
    norm_b = sum(x * x for x in v2) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

def calculate_similarity(text1: str, text2: str, emb1: list = None, emb2: list = None) -> float:
    """
    Calculates similarity using embeddings if available, falling back to SequenceMatcher.
    """
    if emb1 is not None and emb2 is not None:
        return cosine_similarity(emb1, emb2)
    
    # Fallback to local SequenceMatcher
    t1 = (text1 or "").lower().strip()
    t2 = (text2 or "").lower().strip()
    return SequenceMatcher(None, t1, t2).ratio()
