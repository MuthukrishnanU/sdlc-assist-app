import json
import ast
from ..llm import call_llm, parse_llm_json
from ..utils import get_schema_context

async def generate_sparksql(request, schema_context: str) -> dict:
    conversion_prompt = ""
    if getattr(request, "is_conversion", False):
        conversion_prompt = f"""
    === IMPORTANT: CONVERT LEGACY CODE ===
    The user is converting legacy code (like Informatica mapping, PL/SQL, or old SQL scripts).
    The field 'Logic' contains the source code of the legacy application.
    You MUST translate and convert the business logic, joins, filters, mappings, and computations from the legacy code into modern {request.format}.
    Map legacy tables and fields to the schema defined below. If no schemas are provided, infer table structure from legacy logic.
    """

    prompt = f"""
    You are an expert Data Engineer specializing in Apache Spark and SparkSQL.
    {conversion_prompt}
    Your task is to generate highly optimized and clean SparkSQL Python code based on the following request:
    
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
    
    SparkSQL Formatting Instructions:
    1. Generate Python code that executes SQL using the Spark Session (e.g. `result_df = spark.sql('''SELECT ...''')`).
    2. Store the final output DataFrame in a variable named `result_df` (or `final_df` / `df`).
    3. Initialize/use the global `spark` session object directly without re-creating it.
    4. The SQL query inside `spark.sql(...)` MUST project all the columns specified in the 'Columns' list: {", ".join(request.columns)}.
    5. Compute any derived, aggregated, or bucketed columns requested in the 'Logic' and project them in the SQL select statement.
    6. Deduplication Rule: To prevent row duplication when joining a detail table (like `transactionsInfo`) to customer-level tables, deduplicate the detail table before joining it by using a CTE (Common Table Expression) or subquery with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY timestamp DESC) as rn` and filtering for `rn = 1`. Always use `LEFT JOIN` so customers with no transactions are not dropped.
    
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The full executable SparkSQL Python code block.
    - "flow_explanation": (string) A step-by-step description of the SQL query and transformations applied.
    """
    
    max_retries = 3
    feedback = ""
    for attempt in range(max_retries):
        current_prompt = prompt
        if feedback:
            current_prompt += f"\n\n=== Previous Attempt Syntax Failure Feedback ===\n{feedback}\nPlease fix the syntax error, ensuring all opening parentheses and brackets are properly closed, and return clean, valid SparkSQL Python code."
            
        model_to_use = request.model
        if attempt > 0:
            model_to_use = "gpt-4o"
            
        try:
            content, p_tok, c_tok = await call_llm(current_prompt, model_to_use)
        except Exception as e:
            print(f"SparkSQL generation attempt {attempt + 1} failed due to API/connection/quota error: {e}")
            raise e

        try:
            data = parse_llm_json(content)
            code = data.get("generated_code", "")
            # Validate AST syntax (since it's Python code)
            ast.parse(code)
            
            data["prompt_tokens"] = p_tok
            data["completion_tokens"] = c_tok
            return data
        except Exception as e:
            feedback = f"Syntax error occurred: {e}"
            print(f"SparkSQL generation attempt {attempt + 1} failed with syntax error: {e}. Retrying self-correction...")
            
    # Final fallback attempt using gpt-4o
    content, p_tok, c_tok = await call_llm(prompt + "\nNote: Generate strictly valid Python syntax and JSON format.", "gpt-4o")
    data = parse_llm_json(content)
    data["prompt_tokens"] = p_tok
    data["completion_tokens"] = c_tok
    return data
