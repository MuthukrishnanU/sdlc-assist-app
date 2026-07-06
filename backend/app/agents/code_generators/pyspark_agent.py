import json
from ..llm import call_llm, parse_llm_json
from ..utils import get_schema_context

async def generate_pyspark(request, schema_context: str) -> dict:
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
        column_projection_instruction = f"The code MUST project, select, and output all the columns specified in the 'Columns' list: {', '.join(request.columns)}, in addition to any computed or derived columns required by the logic. Do NOT omit any columns from the 'Columns' list in the final output projection."

    prompt = f"""
    You are an expert Data Engineer specializing in Apache Spark, PySpark DataFrame API, and SparkSQL.
    {conversion_prompt}
    Your task is to generate highly optimized PySpark code based on the following request:
    
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
    
    PySpark Formatting Instructions:
    1. If the format requested is standard "PySpark":
       - Generate standard PySpark DataFrame API operations using methods like `.select()`, `.filter()`, `.join()`.
       - Do NOT use raw SQL string inputs unless necessary.
       - Initialize/use the global `spark` session object directly without re-creating it.
       - Store the final output in a DataFrame named `result_df` (or `final_df` / `df`).
    2. If the format is "SparkSQL":
       - Wrap SQL execution inside `spark.sql('''SELECT ...''')`.
    3. {column_projection_instruction}
    4. Compute any derived, aggregated, or bucketed columns requested in the 'Logic' and project them.
    5. Deduplication Rule: To prevent row duplication when joining a detail table (like `transactionsInfo`) to customer-level tables, deduplicate the dataset by using window functions or calling `.dropDuplicates(["customer_id"])` on the final DataFrame. Always use a left join to preserve customer records.    
    6. Join Integrity Rule: You MUST ensure that every column requested in the 'Columns' list is actually present in the final DataFrame's schema before projecting it. If any of the requested columns reside in other tables (such as `transactionsInfo`), you MUST left-join those tables into the main DataFrame (using common keys like `customer_id` or `account_id`) to make those columns available. Never select a column in the final `.select()` statement that is not present in the joined schema.
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The full executable PySpark code block.
    - "flow_explanation": (string) A step-by-step description of the PySpark API transformations applied.
    """
    
    import ast
    
    max_retries = 3
    feedback = ""
    for attempt in range(max_retries):
        current_prompt = prompt
        if feedback:
            current_prompt += f"\n\n=== Previous Attempt Syntax Failure Feedback ===\n{feedback}\nPlease fix the syntax error, ensuring all opening parentheses and brackets are properly closed, and return clean, valid PySpark code."
            
        model_to_use = request.model
        if attempt > 0:
            model_to_use = "gpt-4o"
            
        try:
            content, p_tok, c_tok = await call_llm(current_prompt, model_to_use)
        except Exception as e:
            print(f"PySpark generation attempt {attempt + 1} failed due to API/connection/quota error: {e}")
            raise e

        try:
            data = parse_llm_json(content)
            code = data.get("generated_code", "")
            # Validate AST syntax
            ast.parse(code)
            
            data["prompt_tokens"] = p_tok
            data["completion_tokens"] = c_tok
            return data
        except Exception as e:
            feedback = f"Syntax error occurred: {e}"
            print(f"PySpark generation attempt {attempt + 1} failed with syntax error: {e}. Retrying self-correction...")
            
    # Final fallback attempt using gpt-4o
    content, p_tok, c_tok = await call_llm(prompt + "\nNote: Generate strictly valid Python syntax and JSON format.", "gpt-4o")
    data = parse_llm_json(content)
    data["prompt_tokens"] = p_tok
    data["completion_tokens"] = c_tok
    return data
