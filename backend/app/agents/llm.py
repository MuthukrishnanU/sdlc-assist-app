import os
import json
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(override=True)

def parse_llm_json(content: str) -> dict:
    content = content.strip()
    start_idx = content.find("{")
    end_idx = content.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        json_str = content[start_idx:end_idx+1]
        try:
            return json.loads(json_str)
        except Exception:
            pass
    return json.loads(content)

async def call_llm(prompt: str, model_name: str, response_format_json: bool = True) -> tuple:
    """
    Calls the specified LLM model with the prompt.
    Returns: (content_string, prompt_tokens, completion_tokens)
    """
    # Map full supervisor model strings to execution keys
    if model_name:
        model_name = model_name.strip()
        if "gpt-4o" in model_name:
            model_key = "gpt-4o"
        elif "o3-mini" in model_name:
            model_key = "o3-mini"
        elif "gemini-3.5" in model_name:
            model_key = "gemini-3.5-flash"
        elif "gemini-2.5" in model_name:
            model_key = "gemini-2.5-flash"
        elif "mistral" in model_name:
            model_key = "mistral"
        elif "llama" in model_name.lower():
            model_key = "llama"
        elif "qwen" in model_name.lower():
            model_key = "qwen"
        elif "deepseek" in model_name.lower():
            model_key = "deepseek"
        elif "kimi" in model_name.lower():
            model_key = "kimi"
        else:
            model_key = model_name
    else:
        model_key = "gpt-4o"
        
    prompt_tokens = 0
    completion_tokens = 0
    
    if model_key == "gpt-4o":
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        kwargs = {
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
            "max_tokens": 4096
        }
        if response_format_json:
            kwargs["response_format"] = {"type": "json_object"}
        response = await client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        return content, prompt_tokens, completion_tokens
        
    elif model_key == "o3-mini":
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        kwargs = {
            "model": "o3-mini",
            "messages": [{"role": "user", "content": prompt}]
        }
        if response_format_json:
            kwargs["response_format"] = {"type": "json_object"}
        response = await client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        return content, prompt_tokens, completion_tokens
        
    elif model_key in ["gemini-2.5-flash", "gemini-3.1-flash", "gemini-3.5-flash"]:
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY is not set.")
            
        gemini_mapping = {
            "gemini-2.5-flash": "gemini-2.5-flash",
            "gemini-3.1-flash": "gemini-3.1-flash-lite",
            "gemini-3.5-flash": "gemini-3.5-flash"
        }
        gemini_model = gemini_mapping.get(model_key, "gemini-2.5-flash")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 4096
            }
        }
        if response_format_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"
            
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                raise Exception(f"Gemini API Error ({response.status_code}): {response.text}")
            res_json = response.json()
            content = res_json['candidates'][0]['content']['parts'][0]['text']
            usage = res_json.get('usageMetadata', {})
            prompt_tokens = usage.get('promptTokenCount', 0)
            completion_tokens = usage.get('candidatesTokenCount', 0)
            return content, prompt_tokens, completion_tokens
            
    elif model_key == "mistral":
        mistral_key = os.getenv("MISTRALAI_API_KEY")
        if not mistral_key:
            raise ValueError("MISTRALAI_API_KEY is not set.")
            
        from langchain_mistralai import ChatMistralAI
        llm = ChatMistralAI(model="mistral-large-latest", api_key=mistral_key, temperature=0.0, max_tokens=4096)
        if response_format_json:
            llm = llm.bind(response_format={"type": "json_object"})
        response = await llm.ainvoke(prompt)
        
        usage_metadata = getattr(response, "usage_metadata", None) or {}
        if usage_metadata:
            prompt_tokens = usage_metadata.get("input_tokens", 0)
            completion_tokens = usage_metadata.get("output_tokens", 0)
        else:
            response_metadata = getattr(response, "response_metadata", None) or {}
            token_usage = response_metadata.get("token_usage", {})
            prompt_tokens = token_usage.get("prompt_tokens", 0)
            completion_tokens = token_usage.get("completion_tokens", 0)
            
        return response.content, prompt_tokens, completion_tokens
        
    elif model_key in ["llama", "qwen", "kimi", "deepseek"]:
        together_key = os.getenv("TOGETHER_API_KEY")
        if not together_key:
            raise ValueError("TOGETHER_API_KEY is not set.")
            
        together_mapping = {
            "llama": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "qwen": "Qwen/Qwen3.6-Plus",
            "kimi": "moonshotai/Kimi-K2.6",
            "deepseek": "deepseek-ai/DeepSeek-V4-Pro"
        }
        together_model = together_mapping.get(model_key)
        together_client = AsyncOpenAI(api_key=together_key, base_url="https://api.together.xyz/v1")
        
        kwargs = {
            "model": together_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
            "max_tokens": 4096,
            "stream": True,
            "stream_options": {"include_usage": True}
        }
        if response_format_json:
            kwargs["response_format"] = {"type": "json_object"}
            
        response_stream = await together_client.chat.completions.create(**kwargs)
        chunks = []
        async for chunk in response_stream:
            if chunk.choices and chunk.choices[0].delta.content:
                chunks.append(chunk.choices[0].delta.content)
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens
                completion_tokens = chunk.usage.completion_tokens
                
        content = "".join(chunks)
        return content, prompt_tokens, completion_tokens
        
    else:
        raise ValueError(f"Unsupported model: {model_key}")
