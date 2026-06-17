import asyncio
import os
from dotenv import load_dotenv

dotenv_path = r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend\.env"
load_dotenv(dotenv_path)

import sys
sys.path.append(r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend")

from app.schemas.code_gen import CodeGenerationRequest
from app.agents.utils import get_schema_context
from app.agents.llm import call_llm

async def test_kimi_pyspark():
    req = CodeGenerationRequest(
        format="PySpark",
        tables=['customerDetails', 'loanInfo', 'accountBalances', 'transactionsInfo'],
        columns=['customer_id', 'first_name', 'last_name', 'merchant_name', 'loan_type', 'loan_status', 'credit_score', 'principal_amount', 'transaction_type', 'channel'],
        logic='transactions as UPI inclined customers. Please add this flag into main output dataset and give the name as "loan_customer_transactions".',
        sample_data_size=1000,
        model="moonshotai/Kimi-K2.6",
        role="Data Engineering",
        userId="de_user_1"
    )
    
    schema_ctx = get_schema_context(req.tables)
    
    prompt = f"""
    You are an expert Data Engineer specializing in Apache Spark, PySpark DataFrame API, and SparkSQL.
    Your task is to generate highly optimized PySpark code based on the following request:
    
    Format: {req.format}
    Tables: {", ".join(req.tables)}
    Columns: {", ".join(req.columns)}
    Logic: {req.logic}
    Sample Data Size: {req.sample_data_size}
    {schema_ctx}
    
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
    3. The code MUST project all columns specified in the 'Columns' list: {", ".join(req.columns)}.
    4. Compute any derived, aggregated, or bucketed columns requested in the 'Logic' and project them.
    5. Deduplication Rule: To prevent row duplication when joining a detail table (like `transactionsInfo`) to customer-level tables, deduplicate the dataset by using window functions or calling `.dropDuplicates(["customer_id"])` on the final DataFrame. Always use a left join to preserve customer records.    
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The full executable PySpark code block.
    - "flow_explanation": (string) A step-by-step description of the PySpark API transformations applied.
    """
    
    try:
        content, p_tok, c_tok = await call_llm(prompt, "kimi", response_format_json=True)
        print("RAW CONTENT FROM KIMI:")
        print(repr(content))
    except Exception as e:
        print(f"Call failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_kimi_pyspark())
