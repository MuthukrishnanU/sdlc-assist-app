import json
from ..llm import call_llm, parse_llm_json
from ..utils import get_schema_context

async def generate_sql(request, schema_context: str) -> dict:
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
        column_projection_instruction = f"The SQL query should project only the columns necessary to satisfy the query logic (using the provided schemas as context) out of the specified 'Columns' list: {', '.join(request.columns)}. Avoid selecting unused or redundant columns in the final output."
    else:
        column_projection_instruction = f"The SQL query MUST project, select, and output all the columns specified in the 'Columns' list: {', '.join(request.columns)}, in addition to any computed or derived columns required by the logic. Do NOT omit any columns from the 'Columns' list in the final query select projection."

    prompt = f"""
    You are an expert Data Engineer specializing in relational SQL database systems (SQL, PostgreSQL, MySQL, BigQuery, Snowflake, Oracle, Apache Iceberg).
    {conversion_prompt}
    Your task is to generate highly optimized and clean SQL code based on the following request:
    
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
    
    SQL Formatting Instructions:
    1. Generate a single, clean raw SQL query only. Do not wrap in python functions or variables.
    2. ALWAYS use the exact case-sensitive table names and column names as defined in the schemas above.
    3. {column_projection_instruction}
    4. Compute any derived, aggregated, or bucketed columns requested in the 'Logic' and add them to the select statement.
    5. Deduplication Rule: To prevent row duplication when joining a detail table (like `transactionsInfo`) to customer-level tables, deduplicate the detail table before joining it by using a CTE (Common Table Expression) or subquery with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY timestamp DESC) as rn` and filtering for `rn = 1`. Always use `LEFT JOIN` so customers with no transactions are not dropped.    
    6. Join Integrity Rule: You MUST ensure that every column requested in the 'Columns' list is actually present in the query's tables before projecting it. If any of the requested columns reside in other tables (such as `transactionsInfo`), you MUST left-join those tables (using common keys like `customer_id` or `account_id`) to make those columns available. Never select a column in the final SELECT statement that is not present in the joined schema.
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The raw SQL query.
    - "flow_explanation": (string) A step-by-step description of the tables/columns used and the joins/filters applied.
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
            print(f"SQL generation attempt {attempt + 1} failed due to API/connection/quota error: {e}")
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
            print(f"SQL generation attempt {attempt + 1} failed: {e}. Retrying...")
            
    # Final fallback attempt using gpt-4o
    content, p_tok, c_tok = await call_llm(prompt + "\nNote: Generate strictly valid SQL and JSON format.", "gpt-4o")
    data = parse_llm_json(content)
    data["prompt_tokens"] = p_tok
    data["completion_tokens"] = c_tok
    return data
