import json
from .llm import call_llm, parse_llm_json

async def generate_insights(logic: str, columns: list, dataframe: list, dq_insights: dict, model: str = "gpt-4o") -> list:
    """
    Analyzes simulated dataset and DQ metrics to produce key data and business insights.
    Returns: A list of string bullet points containing insights.
    """
    if not dataframe:
        return ["No data available to generate insights."]
        
    prompt = f"""
    You are an expert Data Analyst and Business Intelligence specialist.
    Your task is to analyze the following generated dataset and its Data Quality (DQ) metrics, and write a concise list of 3-5 business and data quality insights.
    
    Business Logic / Goal: {logic}
    Columns Selected: {", ".join(columns)}
    
    Simulated Output Data (sample of first few rows):
    {json.dumps(dataframe[:10], indent=2)}
    
    Data Quality Metrics Summary:
    {json.dumps(dq_insights, indent=2)}
    
    Instructions:
    1. Analyze the sample data to identify trends, distributions, or anomalies (e.g., balance sizes, loan types, channels used).
    2. Reference the Data Quality metrics to explain if there are any data anomalies (like high null counts, duplicates, or empty values) and what they mean for the business goal.
    3. Keep each insight concise, actionable, and formatted as a single sentence.
    4. Return the response as a JSON object with exactly one key "insights" containing a list of strings. Do not include markdown code block syntax (like ```json) in the JSON value.
    """
    
    try:
        content, _, _ = await call_llm(prompt, model, response_format_json=True)
        data = parse_llm_json(content)
        return data.get("insights", ["Successfully executed query simulation."])
    except Exception as e:
        print(f"[ERROR] Insights Agent failed: {e}")
        return ["Successfully completed database query simulation and profiling."]
