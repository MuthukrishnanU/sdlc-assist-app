import asyncio
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.code_gen import CodeGenerationRequest
from app.agents.supervisor import run_agent_workflow

async def main():
    request = CodeGenerationRequest(
        format="PySpark",
        tables=["customerDetails", "accountBalances", "loanInfo", "transactionsInfo"],
        columns=[
            "customer_id", "first_name", "last_name", "merchant_name",
            "loan_type", "loan_status", "credit_score", "principal_amount",
            "transaction_type", "channel"
        ],
        logic=(
            "10 UPI transactions as UPI inclined customers. "
            "Please add this flag into main output dataset and give the name as \"loan_customer_transactions\""
        ),
        sample_data_size=1000,
        model="kimi",
        userId="de_user_1",
        role="Data Engineer"
    )
    
    try:
        print("Calling agent workflow with model: kimi...")
        result = await run_agent_workflow(request)
        print("\n--- GENERATED CODE ---")
        print(result.get("generated_code"))
        print("\n--- FLOW EXPLANATION ---")
        print(result.get("flow_explanation"))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
