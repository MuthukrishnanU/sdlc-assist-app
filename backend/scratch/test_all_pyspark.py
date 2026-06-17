import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.llm import call_llm, parse_llm_json
from app.schemas.code_gen import CodeGenerationRequest

async def test_model(model_name: str):
    print(f"\n==========================================")
    print(f"Testing model: {model_name}")
    print(f"==========================================")
    
    prompt = """
    You are an expert Data Engineer specializing in Apache Spark, PySpark DataFrame API, and SparkSQL.
    Your task is to generate highly optimized PySpark code based on the following request:
    
    Format: PySpark
    Tables: customerDetails, accountBalances, loanInfo, transactionsInfo
    Columns: customer_id, first_name, last_name, merchant_name, loan_type, loan_status, credit_score, principal_amount, transaction_type, channel
    Logic: 10 UPI transactions as UPI inclined customers. Please add this flag into main output dataset and give the name as "loan_customer_transactions"
    Sample Data Size: 1000
    
    Return the response as a JSON object with exactly these keys:
    - "generated_code": (string) The full executable PySpark code block.
    - "flow_explanation": (string) A step-by-step description of the PySpark API transformations applied.
    """
    
    try:
        content, p_tok, c_tok = await call_llm(prompt, model_name, response_format_json=True)
        print(f"Tokens: prompt={p_tok}, completion={c_tok}")
        print("Raw Content:")
        print(repr(content))
        data = parse_llm_json(content)
        print("Parsed JSON successfully!")
        print("Generated Code Preview:")
        print(data.get("generated_code", "")[:200])
    except Exception as e:
        print(f"FAILED with exception: {type(e).__name__}: {e}")

async def main():
    models = ["gpt-4o", "gemini-3.5-flash", "mistral", "llama", "qwen", "kimi"]
    for model in models:
        await test_model(model)

if __name__ == "__main__":
    asyncio.run(main())
