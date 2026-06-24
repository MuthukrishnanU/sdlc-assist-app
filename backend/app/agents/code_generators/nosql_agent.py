import json
from ..llm import call_llm, parse_llm_json
from ..utils import get_schema_context

async def generate_nosql(request, schema_context: str) -> dict:
    conversion_prompt = ""
    if getattr(request, "is_conversion", False):
        conversion_prompt = f"""
    === IMPORTANT: CONVERT LEGACY CODE ===
    The user is converting legacy code (like Informatica mapping, PL/SQL, or old SQL scripts).
    The field 'Logic' contains the source code of the legacy application.
    You MUST translate and convert the business logic, joins, filters, mappings, and computations from the legacy code into modern {request.format}.
    Map legacy tables and fields to the schema defined below. If no schemas are provided, infer table structure from legacy logic.
    """

    is_cbi = getattr(request, "active_tab", None) == "cbi"
    if is_cbi:
        column_projection_instruction = f"The code should project only the columns necessary to satisfy the query logic (using the provided schemas as context) out of the specified 'Columns' list: {', '.join(request.columns)}. Avoid selecting unused or redundant columns in the final output."
    else:
        column_projection_instruction = f"The code MUST project, select, and output all the columns specified in the 'Columns' list: {', '.join(request.columns)}, in addition to any computed or derived columns required by the logic. Do NOT omit any columns from the 'Columns' list in the final query or pipeline projection (e.g. inside the `$project` stage)."

    prompt = f"""
    You are an expert database engineer specializing in NoSQL databases (specifically MongoDB aggregation pipelines/queries and Google Cloud Firestore Python SDK queries).
    {conversion_prompt}
    Your task is to generate highly optimized NoSQL database code based on the following request:
    
    Format: {request.format}
    Tables: {", ".join(request.tables)}
    Columns: {", ".join(request.columns)}
    Logic: {request.logic}
    Sample Data Size: {request.sample_data_size}
    {schema_context}
    
    === Categorical Values in the Database ===
    Here are the exact string values stored in the database for certain fields. You MUST map user terminology to these exact case-sensitive values:
    - Table `customerDetails` -> column `kyc_status`: 'Verified', 'Pending', 'Failed'
    - Table `accountBalances` -> column `account_type`: 'Savings', 'Current'
    - Table `loanInfo` -> column `loan_type`: 'Home', 'Personal', 'Auto'
    - Table `loanInfo` -> column `loan_status`: 'Active', 'Closed', 'Default'
    - Table `transactionsInfo` -> column `channel`: 'UPI', 'NetBanking', 'ATM', 'POS'
    - Table `transactionsInfo` -> column `status`: 'Success', 'Failed', 'Flagged'
    
    NoSQL Formatting Instructions:
    1. If the format requested is "MongoDB NoSQL":
       - Generate standard MongoDB Python query/aggregation pipeline code (e.g., `db.customerDetails.aggregate([...])`).
       - Use stages like `$lookup` (for joins), `$match` (for filters), `$project` (for column selection), `$group` (for aggregates).
    2. If the format requested is "Firestore NoSQL" (or Firebase/Firestore):
       - Generate Python Firestore SDK queries using `db.collection(...)`.
    3. {column_projection_instruction}
    4. Compute any derived, aggregated, or bucketed columns requested in the 'Logic' and project them.
    5. Deduplication Rule: To prevent row duplication when joining a detail collection, ensure the lookup array is deduplicated or matches the primary document row count correctly.    
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The full NoSQL Python code block.
    - "flow_explanation": (string) A step-by-step description of the NoSQL queries and lookup/match pipeline stages applied.
    """
    
    max_retries = 3
    feedback = ""
    for attempt in range(max_retries):
        current_prompt = prompt
        if feedback:
            current_prompt += f"\n\n=== Previous Attempt Failure Feedback ===\n{feedback}\nPlease fix the issue and return clean, valid JSON with 'generated_code' and 'flow_explanation'."
        
        model_to_use = request.model
        if attempt > 0:
            model_to_use = "gpt-4o"
            
        try:
            content, p_tok, c_tok = await call_llm(current_prompt, model_to_use)
        except Exception as e:
            print(f"NoSQL generation attempt {attempt + 1} failed due to API/connection/quota error: {e}")
            raise e

        try:
            data = parse_llm_json(content)
            if not data.get("generated_code"):
                raise ValueError("Missing 'generated_code' in response.")
            data["prompt_tokens"] = p_tok
            data["completion_tokens"] = c_tok
            return data
        except Exception as e:
            feedback = f"Error occurred: {e}"
            print(f"NoSQL generation attempt {attempt + 1} failed: {e}. Retrying...")
            
    # Final fallback attempt using gpt-4o
    content, p_tok, c_tok = await call_llm(prompt + "\nNote: Generate strictly valid NoSQL and JSON format.", "gpt-4o")
    data = parse_llm_json(content)
    data["prompt_tokens"] = p_tok
    data["completion_tokens"] = c_tok
    return data
