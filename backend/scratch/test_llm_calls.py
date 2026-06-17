import asyncio
import os
from dotenv import load_dotenv

# Load env from backend
backend_dir = r"c:\Users\Welcome\..gemini\antigravity\scratch\sdlc-assist-app\backend"
# Wait, let's use the actual absolute path to backend .env
dotenv_path = r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend\.env"
load_dotenv(dotenv_path)

# Add backend directory to sys.path so we can import app modules
import sys
sys.path.append(r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend")

from app.agents.llm import call_llm

async def main():
    models = ["gpt-4o", "mistral-large-latest", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "moonshotai/Kimi-K2.6"]
    prompt = "Return a JSON object with a single key 'test' and value 'hello'. Do not return any other text."
    
    for model in models:
        print(f"\n--- Testing Model: {model} ---")
        try:
            content, p_tok, c_tok = await call_llm(prompt, model, response_format_json=True)
            print(f"Success! Prompt tokens: {p_tok}, Completion tokens: {c_tok}")
            print("Response content:")
            print(repr(content))
        except Exception as e:
            print(f"Failed: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
