import json
from .utils import get_schema_context
from .llm import call_llm, parse_llm_json

async def generate_test_cases(
    logic: str,
    format_str: str,
    tables: list,
    columns: list,
    generated_code: str,
    model: str = "gpt-4o"
) -> list:
    """
    Generates positive and negative test cases for the given query code.
    Each test case contains a title, description, scenario_type, mock_inputs, and expected_output.
    """
    schema_context = get_schema_context(tables)
    
    prompt = f"""You are an expert Data Engineer and QA Specialist.
Your task is to generate 2 to 3 test cases for the following query logic and code.
At least one test case must be a 'Positive' scenario, and one must be a 'Negative' scenario.

Query Logic requested by user: {logic}
Format: {format_str}
Tables involved: {", ".join(tables)}
Columns selected: {", ".join(columns)}

Generated Code:
```
{generated_code}
```

{schema_context}

Generate mock input data for each of the tables listed in "Tables involved".
Ensure the mock data columns exactly match the fields defined in the schema.
The mock input rows should be simple, realistic, and contain values that would trigger the conditional logic of the query (e.g. matching statuses, dates, amounts, etc.).

For the expected output:
- Specify the `expected_row_count` (integer) that should result when running the generated code on this mock data.
- Provide a clear `description` of what is expected in the resulting dataset.

You MUST return your output in JSON format with a single key "test_cases" containing a list of test cases.
Each test case must have the following structure:
{{
  "title": "Scenario Title",
  "description": "Scenario description explaining what is being tested",
  "scenario_type": "Positive" | "Negative",
  "mock_inputs": {{
    "table_name_1": [
      {{ "column_1": "val1", "column_2": 100 }}
    ],
    "table_name_2": [
      {{ "column_a": "valA", "column_b": "valB" }}
    ]
  }},
  "expected_output": {{
    "expected_row_count": 1,
    "description": "Expected output description"
  }}
}}

Make sure the JSON is valid and can be parsed directly. Do not include any formatting other than the JSON object.
"""
    try:
        content, _, _ = await call_llm(prompt, model, response_format_json=True)
        res_dict = parse_llm_json(content)
        return res_dict.get("test_cases", [])
    except Exception as e:
        print(f"Error generating test cases: {e}")
        # Return fallback test cases to avoid blank UI
        fallback_cases = []
        for index, s_type in enumerate(["Positive", "Negative"]):
            fallback_mock = {}
            for t in tables:
                fallback_mock[t] = []
            fallback_cases.append({
                "title": f"Fallback {s_type} Test Case",
                "description": f"Verify logic using a default {s_type.lower()} input scenario.",
                "scenario_type": s_type,
                "mock_inputs": fallback_mock,
                "expected_output": {
                    "expected_row_count": 1 if s_type == "Positive" else 0,
                    "description": f"Should return results matching the {s_type.lower()} condition."
                }
            })
        return fallback_cases
