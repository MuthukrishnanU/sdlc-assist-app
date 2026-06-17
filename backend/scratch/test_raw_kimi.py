import asyncio
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI

dotenv_path = r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend\.env"
load_dotenv(dotenv_path)

async def test_raw_kimi():
    together_key = os.getenv("TOGETHER_API_KEY")
    together_client = AsyncOpenAI(api_key=together_key, base_url="https://api.together.xyz/v1")
    prompt = "Return a JSON object with a single key 'test' and value 'hello'. Do not return any other text."
    
    kwargs = {
        "model": "moonshotai/Kimi-K2.6",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = await together_client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        print("RAW CONTENT:")
        print(repr(content))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_raw_kimi())
