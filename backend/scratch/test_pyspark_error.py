import asyncio
import os
from dotenv import load_dotenv

dotenv_path = r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend\.env"
load_dotenv(dotenv_path)

import sys
sys.path.append(r"c:\Users\Welcome\.gemini\antigravity\scratch\sdlc-assist-app\backend")

from app.schemas.code_gen import CodeGenerationRequest
from app.agents.code_generators.pyspark_agent import generate_pyspark
from app.agents.utils import get_schema_context

async def run_pyspark_test():
    req = CodeGenerationRequest(
        format="PySpark",
        tables=['customerDetails', 'loanInfo', 'accountBalances', 'transactionsInfo'],
        columns=['customer_id', 'first_name', 'last_name', 'merchant_name', 'loan_type', 'loan_status', 'credit_score', 'principal_amount', 'transaction_type', 'channel'],
        logic='transactions as UPI inclined customers. Please add this flag into main output dataset and give the name as "loan_customer_transactions".',
        sample_data_size=1000,
        model="gpt-4o",
        role="Data Engineering",
        userId="de_user_1"
    )
    
    schema_ctx = get_schema_context(req.tables)
    
    models = ["gpt-4o", "mistral-large-latest", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "moonshotai/Kimi-K2.6"]
    for m in models:
        print(f"\n==========================================")
        print(f"Testing Model: {m}")
        print(f"==========================================")
        req.model = m
        try:
            res = await generate_pyspark(req, schema_ctx)
            print("Success!")
            # print(res.get("generated_code")[:200] + "...")
        except Exception as e:
            print(f"Failed with syntax error / Exception: {e}")
            # print traceback
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_pyspark_test())
