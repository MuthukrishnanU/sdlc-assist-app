import json
from .llm import call_llm, parse_llm_json

async def generate_personas(logic: str, columns: list, model: str = "gpt-4o") -> list:
    """
    Generates target user personas explaining who would run this query or consume this dataset.
    Returns: A list of dicts representing user personas.
    """
    prompt = f"""
    You are an expert UX Researcher and Product Manager.
    Based on the following data extraction logic, identify 1-2 target user personas (e.g., Risk Analyst, Branch Manager, Campaign Coordinator) who would run this query or consume this data.
    
    Business Logic / Goal: {logic}
    Columns Projecting: {", ".join(columns)}
    
    For each persona, define:
    - Name: A realistic fictional name
    - Role: Role Title/Description
    - Motivation: Why they care about this dataset
    - Scenario: A specific business scenario where they use this data to make decisions
    
    Return the response as a JSON object with exactly one key "personas" containing a list of objects.
    Each object must have these keys: "name", "role", "motivation", "scenario".
    Do not include markdown code block syntax (like ```json) in the JSON value.
    """
    
    try:
        content, _, _ = await call_llm(prompt, model, response_format_json=True)
        data = parse_llm_json(content)
        return data.get("personas", [])
    except Exception as e:
        print(f"[ERROR] Persona Agent failed: {e}")
        return [
            {
                "name": "Jane Doe",
                "role": "Data Analyst",
                "motivation": "Auditing and profile analytics reporting",
                "scenario": "Running regular validation on extracted columns for business operations."
            }
        ]
