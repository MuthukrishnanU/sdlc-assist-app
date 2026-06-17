import os
from fastapi import HTTPException

async def validate_profanity(logic_prompt: str):
    """
    Checks logic prompt for bad words and profanity using OpenAI's omni-moderation-latest API.
    """
    if not logic_prompt:
        return
        
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[WARNING] OPENAI_API_KEY is not set. Skipping profanity moderation check.")
        return
        
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        response = await client.moderations.create(
            input=logic_prompt,
            model="omni-moderation-latest"
        )
        if response.results[0].flagged:
            # Find categories that triggered the flag
            triggered = [cat for cat, val in response.results[0].categories if val]
            detail_msg = f" (Flagged categories: {', '.join(triggered)})" if triggered else ""
            raise HTTPException(
                status_code=400,
                detail=f"Guardrail Violation: Inappropriate prompt content detected by moderation system.{detail_msg}"
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[ERROR] OpenAI Moderation API failed: {e}")
